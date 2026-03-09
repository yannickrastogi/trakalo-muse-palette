import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useTeams } from "@/contexts/TeamContext";

// ── Types ──

export type ApprovalMode = "everyone_requires_approval" | "everyone_auto_approved" | "custom_by_user";
export type MemberApprovalRule = "requires_approval" | "auto_approved";
export type SendType = "track" | "playlist" | "pitch" | "share_link" | "recipient_send" | "other";
export type SendStatus = "draft" | "pending_approval" | "approved" | "rejected" | "sent" | "cancelled";

export interface TeamApprovalSettings {
  teamId: string;
  approvalMode: ApprovalMode;
  updatedAt: string;
}

export interface MemberApprovalSetting {
  teamId: string;
  userId: string;
  rule: MemberApprovalRule;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  sendId: string;
  eventType: string;
  actorName: string;
  note?: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface SendRecord {
  id: string;
  teamId: string;
  createdByUserId: string;
  createdByName: string;
  createdByRole: string;
  sendType: SendType;
  relatedEntityId?: string;
  relatedEntityTitle: string;
  recipients: string;
  message: string;
  status: SendStatus;
  approvalRequired: boolean;
  approvalModeSnapshot: ApprovalMode;
  senderApprovalRuleSnapshot: MemberApprovalRule | "n/a";
  autoApproved: boolean;
  submittedForApprovalAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  internalNote?: string;
  createdAt: string;
  sentAt?: string;
}

interface ApprovalContextValue {
  // Settings
  getTeamSettings: (teamId: string) => TeamApprovalSettings;
  setTeamApprovalMode: (teamId: string, mode: ApprovalMode) => void;
  getMemberRule: (teamId: string, userId: string) => MemberApprovalRule;
  setMemberRule: (teamId: string, userId: string, rule: MemberApprovalRule) => void;

  // Sends
  sends: SendRecord[];
  createSend: (send: Omit<SendRecord, "id" | "status" | "approvalRequired" | "approvalModeSnapshot" | "senderApprovalRuleSnapshot" | "autoApproved" | "createdAt">) => SendRecord;
  approveSend: (sendId: string, approverName: string, note?: string) => void;
  rejectSend: (sendId: string, rejectorName: string, reason?: string, note?: string) => void;
  cancelSend: (sendId: string) => void;
  getPendingSends: (teamId?: string) => SendRecord[];
  getSendById: (id: string) => SendRecord | undefined;
  getAuditTrail: (sendId: string) => AuditEvent[];

  // Notifications
  approvalNotifications: ApprovalNotification[];
  clearApprovalNotification: (id: string) => void;

  // Helper
  doesSenderRequireApproval: (teamId: string, userId: string) => boolean;
}

export interface ApprovalNotification {
  id: string;
  sendId: string;
  type: "pending" | "approved" | "rejected" | "auto_approved";
  message: string;
  createdAt: string;
  read: boolean;
}

const ApprovalContext = createContext<ApprovalContextValue | undefined>(undefined);

let nextId = 1000;

// Demo sends
const demoSends: SendRecord[] = [
  {
    id: "send-1",
    teamId: "team-1",
    createdByUserId: "m-2",
    createdByName: "Marco Silva",
    createdByRole: "Songwriter",
    sendType: "pitch",
    relatedEntityTitle: "Velvet Skies",
    recipients: "Atlantic Records",
    message: "Hi, please consider this track for your upcoming playlist.",
    status: "pending_approval",
    approvalRequired: true,
    approvalModeSnapshot: "everyone_requires_approval",
    senderApprovalRuleSnapshot: "requires_approval",
    autoApproved: false,
    submittedForApprovalAt: "2026-03-09T10:30:00",
    createdAt: "2026-03-09T10:30:00",
  },
  {
    id: "send-2",
    teamId: "team-1",
    createdByUserId: "m-1",
    createdByName: "Dex Moraes",
    createdByRole: "Producer",
    sendType: "share_link",
    relatedEntityTitle: "Midnight Run",
    recipients: "Sony Music A&R",
    message: "Sharing the latest mix for review.",
    status: "pending_approval",
    approvalRequired: true,
    approvalModeSnapshot: "everyone_requires_approval",
    senderApprovalRuleSnapshot: "requires_approval",
    autoApproved: false,
    submittedForApprovalAt: "2026-03-08T15:00:00",
    createdAt: "2026-03-08T15:00:00",
  },
  {
    id: "send-3",
    teamId: "team-1",
    createdByUserId: "m-0",
    createdByName: "You",
    createdByRole: "Admin",
    sendType: "track",
    relatedEntityTitle: "Neon Dreams",
    recipients: "Warner Records",
    message: "",
    status: "sent",
    approvalRequired: false,
    approvalModeSnapshot: "everyone_requires_approval",
    senderApprovalRuleSnapshot: "n/a",
    autoApproved: true,
    createdAt: "2026-03-07T09:00:00",
    approvedByName: "System",
    approvedAt: "2026-03-07T09:00:00",
    sentAt: "2026-03-07T09:00:01",
  },
  {
    id: "send-4",
    teamId: "team-1",
    createdByUserId: "m-3",
    createdByName: "Tony Maserati",
    createdByRole: "Mix Engineer",
    sendType: "playlist",
    relatedEntityTitle: "Summer EP — Final Selects",
    recipients: "Republic Records",
    message: "Final selects for the summer EP.",
    status: "rejected",
    approvalRequired: true,
    approvalModeSnapshot: "everyone_requires_approval",
    senderApprovalRuleSnapshot: "requires_approval",
    autoApproved: false,
    submittedForApprovalAt: "2026-03-06T11:00:00",
    createdAt: "2026-03-06T11:00:00",
    rejectedByName: "You",
    rejectedAt: "2026-03-06T14:30:00",
    rejectionReason: "Missing updated mix for track 3. Please resubmit after revision.",
  },
];

const demoAudit: AuditEvent[] = [
  { id: "ae-1", sendId: "send-1", eventType: "send_created", actorName: "Marco Silva", createdAt: "2026-03-09T10:30:00" },
  { id: "ae-2", sendId: "send-1", eventType: "submitted_for_approval", actorName: "Marco Silva", createdAt: "2026-03-09T10:30:00" },
  { id: "ae-3", sendId: "send-2", eventType: "send_created", actorName: "Dex Moraes", createdAt: "2026-03-08T15:00:00" },
  { id: "ae-4", sendId: "send-2", eventType: "submitted_for_approval", actorName: "Dex Moraes", createdAt: "2026-03-08T15:00:00" },
  { id: "ae-5", sendId: "send-3", eventType: "send_created", actorName: "You", createdAt: "2026-03-07T09:00:00" },
  { id: "ae-6", sendId: "send-3", eventType: "auto_approved", actorName: "System", createdAt: "2026-03-07T09:00:00" },
  { id: "ae-7", sendId: "send-3", eventType: "sent", actorName: "System", createdAt: "2026-03-07T09:00:01" },
  { id: "ae-8", sendId: "send-4", eventType: "send_created", actorName: "Tony Maserati", createdAt: "2026-03-06T11:00:00" },
  { id: "ae-9", sendId: "send-4", eventType: "submitted_for_approval", actorName: "Tony Maserati", createdAt: "2026-03-06T11:00:00" },
  { id: "ae-10", sendId: "send-4", eventType: "rejected", actorName: "You", note: "Missing updated mix for track 3. Please resubmit after revision.", createdAt: "2026-03-06T14:30:00" },
];

const demoNotifications: ApprovalNotification[] = [
  { id: "an-1", sendId: "send-1", type: "pending", message: "New pitch pending approval from Marco Silva — \"Velvet Skies\"", createdAt: "2026-03-09T10:30:00", read: false },
  { id: "an-2", sendId: "send-2", type: "pending", message: "Share link pending approval from Dex Moraes — \"Midnight Run\"", createdAt: "2026-03-08T15:00:00", read: false },
];

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const [teamSettings, setTeamSettings] = useState<Record<string, TeamApprovalSettings>>({
    "team-1": { teamId: "team-1", approvalMode: "everyone_requires_approval", updatedAt: "2026-03-01T00:00:00" },
    "team-2": { teamId: "team-2", approvalMode: "everyone_auto_approved", updatedAt: "2026-01-10T00:00:00" },
  });

  const [memberRules, setMemberRules] = useState<Record<string, MemberApprovalRule>>({});
  const [sends, setSends] = useState<SendRecord[]>(demoSends);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>(demoAudit);
  const [notifications, setNotifications] = useState<ApprovalNotification[]>(demoNotifications);

  const getTeamSettings = useCallback((teamId: string): TeamApprovalSettings => {
    return teamSettings[teamId] || { teamId, approvalMode: "everyone_auto_approved", updatedAt: new Date().toISOString() };
  }, [teamSettings]);

  const setTeamApprovalMode = useCallback((teamId: string, mode: ApprovalMode) => {
    const now = new Date().toISOString();
    setTeamSettings(prev => ({
      ...prev,
      [teamId]: { teamId, approvalMode: mode, updatedAt: now },
    }));
    setAuditTrail(prev => [...prev, {
      id: `ae-${++nextId}`,
      sendId: "",
      eventType: "approval_mode_changed",
      actorName: "You",
      previousValue: prev[teamId]?.approvalMode || "unknown",
      newValue: mode,
      createdAt: now,
    } as AuditEvent]);
  }, [teamSettings]);

  const getMemberRule = useCallback((teamId: string, userId: string): MemberApprovalRule => {
    return memberRules[`${teamId}:${userId}`] || "requires_approval";
  }, [memberRules]);

  const setMemberRule = useCallback((teamId: string, userId: string, rule: MemberApprovalRule) => {
    setMemberRules(prev => ({ ...prev, [`${teamId}:${userId}`]: rule }));
  }, []);

  const doesSenderRequireApproval = useCallback((teamId: string, userId: string): boolean => {
    const settings = teamSettings[teamId];
    if (!settings) return false;
    switch (settings.approvalMode) {
      case "everyone_requires_approval":
        return true;
      case "everyone_auto_approved":
        return false;
      case "custom_by_user":
        return getMemberRule(teamId, userId) === "requires_approval";
    }
  }, [teamSettings, getMemberRule]);

  const createSend = useCallback((sendInput: Omit<SendRecord, "id" | "status" | "approvalRequired" | "approvalModeSnapshot" | "senderApprovalRuleSnapshot" | "autoApproved" | "createdAt">): SendRecord => {
    const now = new Date().toISOString();
    const settings = getTeamSettings(sendInput.teamId);
    const requiresApproval = doesSenderRequireApproval(sendInput.teamId, sendInput.createdByUserId);
    const memberRule = settings.approvalMode === "custom_by_user"
      ? getMemberRule(sendInput.teamId, sendInput.createdByUserId)
      : "n/a" as MemberApprovalRule | "n/a";

    const newSend: SendRecord = {
      ...sendInput,
      id: `send-${++nextId}`,
      status: requiresApproval ? "pending_approval" : "approved",
      approvalRequired: requiresApproval,
      approvalModeSnapshot: settings.approvalMode,
      senderApprovalRuleSnapshot: memberRule,
      autoApproved: !requiresApproval,
      createdAt: now,
      submittedForApprovalAt: requiresApproval ? now : undefined,
      approvedByName: !requiresApproval ? "System (Auto)" : undefined,
      approvedAt: !requiresApproval ? now : undefined,
      sentAt: !requiresApproval ? now : undefined,
    };

    if (!requiresApproval) {
      newSend.status = "sent";
    }

    setSends(prev => [newSend, ...prev]);

    // Audit
    const events: AuditEvent[] = [
      { id: `ae-${++nextId}`, sendId: newSend.id, eventType: "send_created", actorName: sendInput.createdByName, createdAt: now },
    ];
    if (requiresApproval) {
      events.push({ id: `ae-${++nextId}`, sendId: newSend.id, eventType: "submitted_for_approval", actorName: sendInput.createdByName, createdAt: now });
      // Notify admin
      setNotifications(prev => [{
        id: `an-${++nextId}`,
        sendId: newSend.id,
        type: "pending",
        message: `New ${sendInput.sendType} pending approval from ${sendInput.createdByName} — "${sendInput.relatedEntityTitle}"`,
        createdAt: now,
        read: false,
      }, ...prev]);
    } else {
      events.push({ id: `ae-${++nextId}`, sendId: newSend.id, eventType: "auto_approved", actorName: "System", createdAt: now });
      events.push({ id: `ae-${++nextId}`, sendId: newSend.id, eventType: "sent", actorName: "System", createdAt: now });
    }
    setAuditTrail(prev => [...prev, ...events]);

    return newSend;
  }, [getTeamSettings, doesSenderRequireApproval, getMemberRule]);

  const approveSend = useCallback((sendId: string, approverName: string, note?: string) => {
    const now = new Date().toISOString();
    setSends(prev => prev.map(s => s.id === sendId ? {
      ...s,
      status: "sent" as SendStatus,
      approvedByName: approverName,
      approvedAt: now,
      sentAt: now,
      internalNote: note || s.internalNote,
    } : s));
    setAuditTrail(prev => [...prev,
      { id: `ae-${++nextId}`, sendId, eventType: "manually_approved", actorName: approverName, note, createdAt: now },
      { id: `ae-${++nextId}`, sendId, eventType: "sent", actorName: "System", createdAt: now },
    ]);
    const send = sends.find(s => s.id === sendId);
    if (send) {
      setNotifications(prev => [{
        id: `an-${++nextId}`,
        sendId,
        type: "approved",
        message: `Your ${send.sendType} "${send.relatedEntityTitle}" has been approved and sent`,
        createdAt: now,
        read: false,
      }, ...prev]);
    }
  }, [sends]);

  const rejectSend = useCallback((sendId: string, rejectorName: string, reason?: string, note?: string) => {
    const now = new Date().toISOString();
    setSends(prev => prev.map(s => s.id === sendId ? {
      ...s,
      status: "rejected" as SendStatus,
      rejectedByName: rejectorName,
      rejectedAt: now,
      rejectionReason: reason || s.rejectionReason,
      internalNote: note || s.internalNote,
    } : s));
    setAuditTrail(prev => [...prev,
      { id: `ae-${++nextId}`, sendId, eventType: "rejected", actorName: rejectorName, note: reason, createdAt: now },
    ]);
    const send = sends.find(s => s.id === sendId);
    if (send) {
      setNotifications(prev => [{
        id: `an-${++nextId}`,
        sendId,
        type: "rejected",
        message: `Your ${send.sendType} "${send.relatedEntityTitle}" was rejected${reason ? `: ${reason}` : ""}`,
        createdAt: now,
        read: false,
      }, ...prev]);
    }
  }, [sends]);

  const cancelSend = useCallback((sendId: string) => {
    const now = new Date().toISOString();
    setSends(prev => prev.map(s => s.id === sendId ? { ...s, status: "cancelled" as SendStatus } : s));
    setAuditTrail(prev => [...prev,
      { id: `ae-${++nextId}`, sendId, eventType: "cancelled", actorName: "You", createdAt: now },
    ]);
  }, []);

  const getPendingSends = useCallback((teamId?: string) => {
    return sends.filter(s => s.status === "pending_approval" && (!teamId || s.teamId === teamId));
  }, [sends]);

  const getSendById = useCallback((id: string) => sends.find(s => s.id === id), [sends]);

  const getAuditTrail = useCallback((sendId: string) => {
    return auditTrail.filter(e => e.sendId === sendId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [auditTrail]);

  const clearApprovalNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  return (
    <ApprovalContext.Provider value={{
      getTeamSettings, setTeamApprovalMode,
      getMemberRule, setMemberRule,
      sends, createSend, approveSend, rejectSend, cancelSend,
      getPendingSends, getSendById, getAuditTrail,
      approvalNotifications: notifications, clearApprovalNotification,
      doesSenderRequireApproval,
    }}>
      {children}
    </ApprovalContext.Provider>
  );
}

export function useApprovals() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApprovals must be used within ApprovalProvider");
  return ctx;
}
