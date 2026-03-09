import type { ContactExportEntry } from "@/lib/pdf-generators";
import { format } from "date-fns";

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

export function exportContactsCsv(contacts: ContactExportEntry[]) {
  const headers = ["Name", "Email", "Organization", "Role"];
  const rows = contacts.map((c) => [
    `${c.firstName} ${c.lastName}`,
    c.email,
    c.organization,
    c.role,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadBlob(csv, "trakalog-contacts.csv", "text/csv;charset=utf-8;");
}

export function exportContactsXlsx(contacts: ContactExportEntry[]) {
  const headers = ["Name", "Email", "Organization", "Role"];

  const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rows = contacts.map((c) => [
    `${c.firstName} ${c.lastName}`,
    c.email,
    c.organization,
    c.role,
  ]);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#FF8C1A" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF"/></Style>
  </Styles>
  <Worksheet ss:Name="Contacts">
    <Table>`;

  // Header row
  xml += `\n      <Row>`;
  headers.forEach((h) => {
    xml += `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  });
  xml += `</Row>`;

  // Data rows
  rows.forEach((row) => {
    xml += `\n      <Row>`;
    row.forEach((cell) => {
      xml += `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
    });
    xml += `</Row>`;
  });

  xml += `\n    </Table>\n  </Worksheet>\n</Workbook>`;

  downloadBlob(xml, "trakalog-contacts.xlsx", "application/vnd.ms-excel");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
