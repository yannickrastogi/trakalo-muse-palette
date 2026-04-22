import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

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

function mapDbStatusToSend(status: string): SendStatus {
  switch (status) {
    case "pending": return "pending_approval";
    case "approved": return "approved";
    case "rejected": return "rejected";
    default: return "pending_approval";
  }
}

function mapSendStatusToDb(status: SendStatus): string {
  switch (status) {
    case "pending_approval": return "pending";
    case "approved": case "sent": return "approved";
    case "rejected": return "rejected";
    default: return "pending";
  }
}

function mapRowToSend(row: Record<string, unknown>): SendRecord {
  const changes = (row.changes as Record<string, unknown>) || {};
  const dbStatus = (row.status as string) || "pending";
  const sendStatus = mapDbStatusToSend(dbStatus);

  return {
    id: row.id as string,
    teamId: row.workspace_id as string,
    createdByUserId: (row.requested_by as string) || "",
    createdByName: (changes.created_by_name as string) || "",
    createdByRole: (changes.created_by_role as string) || "",
    sendType: (changes.send_type as SendType) || "track",
    relatedEntityId: row.track_id as string,
    relatedEntityTitle: (changes.entity_title as string) || "",
    recipients: (changes.recipients as string) || "",
    message: (changes.message as string) || "",
    status: sendStatus === "approved" && changes.sent_at ? "sent" : sendStatus,
    approvalRequired: dbStatus === "pending" || dbStatus === "rejected" || !!(changes.approval_required),
    approvalModeSnapshot: (changes.approval_mode as ApprovalMode) || "everyone_auto_approved",
    senderApprovalRuleSnapshot: (changes.sender_rule as MemberApprovalRule | "n/a") || "n/a",
    autoApproved: !!(changes.auto_approved),
    submittedForApprovalAt: (row.requested_at as string) || undefined,
    approvedByName: dbStatus === "approved" ? (changes.approved_by_name as string) || "" : undefined,
    approvedAt: (row.reviewed_at as string) || undefined,
    rejectedByName: dbStatus === "rejected" ? (changes.rejected_by_name as string) || "" : undefined,
    rejectedAt: dbStatus === "rejected" ? (row.reviewed_at as string) || undefined : undefined,
    rejectionReason: (row.review_note as string) || undefined,
    internalNote: (changes.internal_note as string) || undefined,
    createdAt: (row.requested_at as string) || "",
    sentAt: (changes.sent_at as string) || undefined,
  };
}

function localId(prefix: string) {
  return prefix + crypto.randomUUID();
}

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [teamSettings, setTeamSettings] = useState<Record<string, TeamApprovalSettings>>({});
  const [memberRules, setMemberRules] = useState<Record<string, MemberApprovalRule>>({});
  const [sends, setSends] = useState<SendRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<ApprovalNotification[]>([]);

  // Fetch approvals from Supabase
  const fetchApprovals = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setSends([]);
      return;
    }

    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Error fetching approvals:", error);
      setSends([]);
      return;
    }

    const mapped = (data || []).map((row) => mapRowToSend(row as unknown as Record<string, unknown>));
    setSends(mapped);

    // Build notifications from pending approvals
    const pendingNotifs: ApprovalNotification[] = mapped
      .filter((s) => s.status === "pending_approval")
      .map((s) => ({
        id: "an-" + s.id,
        sendId: s.id,
        type: "pending" as const,
        message: "New " + s.sendType + " pending approval from " + s.createdByName + ' — "' + s.relatedEntityTitle + '"',
        createdAt: s.createdAt,
        read: false,
      }));
    setNotifications(pendingNotifs);
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const getTeamSettings = useCallback((teamId: string): TeamApprovalSettings => {
    return teamSettings[teamId] || { teamId, approvalMode: "everyone_auto_approved", updatedAt: new Date().toISOString() };
  }, [teamSettings]);

  const setTeamApprovalMode = useCallback((teamId: string, mode: ApprovalMode) => {
    const now = new Date().toISOString();
    setTeamSettings(prev => ({
      ...prev,
      [teamId]: { teamId, approvalMode: mode, updatedAt: now },
    }));
  }, []);

  const getMemberRule = useCallback((teamId: string, userId: string): MemberApprovalRule => {
    return memberRules[teamId + ":" + userId] || "requires_approval";
  }, [memberRules]);

  const setMemberRule = useCallback((teamId: string, userId: string, rule: MemberApprovalRule) => {
    setMemberRules(prev => ({ ...prev, [teamId + ":" + userId]: rule }));
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

    const localId = localId("send-");

    const newSend: SendRecord = {
      ...sendInput,
      id: localId,
      status: requiresApproval ? "pending_approval" : "sent",
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

    setSends(prev => [newSend, ...prev]);

    // Persist to Supabase
    if (activeWorkspace && user) {
      supabase
        .rpc("insert_approval", {
          _user_id: user.id,
          _workspace_id: activeWorkspace.id,
          _track_id: sendInput.relatedEntityId || sendInput.teamId,
          _send_type: sendInput.sendType,
          _team_id: sendInput.teamId || null,
        })
        .then(({ data, error }) => {
          if (error) {
            console.error("Error creating approval:", error);
          } else if (data) {
            // Update local id with Supabase id
            setSends(prev => prev.map(s => s.id === localId ? { ...s, id: data.id } : s));
          }
        }).catch(function (err) { console.error("Error:", err); });
    }

    if (requiresApproval) {
      setNotifications(prev => [{
        id: "an-" + localId,
        sendId: localId,
        type: "pending",
        message: "New " + sendInput.sendType + " pending approval from " + sendInput.createdByName + ' — "' + sendInput.relatedEntityTitle + '"',
        createdAt: now,
        read: false,
      }, ...prev]);
    }

    // Audit
    const events: AuditEvent[] = [
      { id: localId("ae-"), sendId: localId, eventType: "send_created", actorName: sendInput.createdByName, createdAt: now },
    ];
    if (requiresApproval) {
      events.push({ id: localId("ae-"), sendId: localId, eventType: "submitted_for_approval", actorName: sendInput.createdByName, createdAt: now });
    } else {
      events.push({ id: localId("ae-"), sendId: localId, eventType: "auto_approved", actorName: "System", createdAt: now });
      events.push({ id: localId("ae-"), sendId: localId, eventType: "sent", actorName: "System", createdAt: now });
    }
    setAuditTrail(prev => [...prev, ...events]);

    return newSend;
  }, [activeWorkspace, user, getTeamSettings, doesSenderRequireApproval, getMemberRule]);

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

    // Persist via SECURITY DEFINER RPC
    supabase
      .rpc("update_approval_status", {
        _user_id: user?.id || null,
        _approval_id: sendId,
        _status: "approved",
        _note: note || null,
      })
      .then(({ error }) => {
        if (error) console.error("Error approving:", error);
      }).catch(function (err) { console.error("Error:", err); });

    setAuditTrail(prev => [...prev,
      { id: localId("ae-"), sendId, eventType: "manually_approved", actorName: approverName, note, createdAt: now },
      { id: localId("ae-"), sendId, eventType: "sent", actorName: "System", createdAt: now },
    ]);

    const send = sends.find(s => s.id === sendId);
    if (send) {
      setNotifications(prev => [{
        id: localId("an-"),
        sendId,
        type: "approved",
        message: 'Your ' + send.sendType + ' "' + send.relatedEntityTitle + '" has been approved and sent',
        createdAt: now,
        read: false,
      }, ...prev]);
    }
  }, [sends, user]);

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

    // Persist via SECURITY DEFINER RPC
    supabase
      .rpc("update_approval_status", {
        _user_id: user?.id || null,
        _approval_id: sendId,
        _status: "rejected",
        _note: reason || null,
      })
      .then(({ error }) => {
        if (error) console.error("Error rejecting:", error);
      }).catch(function (err) { console.error("Error:", err); });

    setAuditTrail(prev => [...prev,
      { id: localId("ae-"), sendId, eventType: "rejected", actorName: rejectorName, note: reason, createdAt: now },
    ]);

    const send = sends.find(s => s.id === sendId);
    if (send) {
      setNotifications(prev => [{
        id: localId("an-"),
        sendId,
        type: "rejected",
        message: 'Your ' + send.sendType + ' "' + send.relatedEntityTitle + '" was rejected' + (reason ? ": " + reason : ""),
        createdAt: now,
        read: false,
      }, ...prev]);
    }
  }, [sends, user]);

  const cancelSend = useCallback((sendId: string) => {
    const now = new Date().toISOString();
    setSends(prev => prev.map(s => s.id === sendId ? { ...s, status: "cancelled" as SendStatus } : s));
    setAuditTrail(prev => [...prev,
      { id: localId("ae-"), sendId, eventType: "cancelled", actorName: "You", createdAt: now },
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
    <ApprovalContext.Provider value={useMemo(() => ({
      getTeamSettings, setTeamApprovalMode,
      getMemberRule, setMemberRule,
      sends, createSend, approveSend, rejectSend, cancelSend,
      getPendingSends, getSendById, getAuditTrail,
      approvalNotifications: notifications, clearApprovalNotification,
      doesSenderRequireApproval,
    }), [getTeamSettings, setTeamApprovalMode, getMemberRule, setMemberRule, sends, createSend, approveSend, rejectSend, cancelSend, getPendingSends, getSendById, getAuditTrail, notifications, clearApprovalNotification, doesSenderRequireApproval])}>
      {children}
    </ApprovalContext.Provider>
  );
}

export function useApprovals() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApprovals must be used within ApprovalProvider");
  return ctx;
}
