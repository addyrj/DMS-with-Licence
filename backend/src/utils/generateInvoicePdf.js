// src/utils/generateInvoicePdf.js
import PDFDocument from 'pdfkit';
import path        from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../../dms-frontend/public/logo.png');

const PRIMARY  = '#0D9488';
const DARK     = '#1F2937';
const GRAY     = '#6B7280';
const LIGHT_BG = '#F9FAFB';
const BORDER   = '#E5E7EB';

export const generateInvoicePdf = ({ invoiceNo, date, client, item, qty, unitPrice, total, paymentId, newPlan }) => {
  return new Promise((resolve, reject) => {
    // size A4, fixed margins, autoFirstPage
    const doc    = new PDFDocument({ margin:0, size:'A4', autoFirstPage:true });
    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', e   => reject(e));

    const PW = 595.28;  // A4 width in points
    const PH = 841.89;  // A4 height in points
    const ML = 40;      // left margin
    const MR = 40;      // right margin
    const CW = PW - ML - MR; // content width = 515.28

    // ── Header green bar ─────────────────────────────────────
    doc.rect(0, 0, PW, 90).fill(PRIMARY);

    // Logo
    try { doc.image(LOGO_PATH, ML, 18, { height:54 }); } catch {}

    // Company name right side
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
       .text('IOTtech Smart Products Pvt. Ltd.', ML, 22, { align:'right', width:CW });
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(9).font('Helvetica')
       .text('Digital Signage Management System', ML, 46, { align:'right', width:CW });

    // ── PAYMENT INVOICE title + meta ──────────────────────────
    let y = 108;

    doc.fillColor(PRIMARY).fontSize(20).font('Helvetica-Bold')
       .text('PAYMENT INVOICE', ML, y);

    // Right side meta block
    const metaX = ML + CW - 200;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('Invoice No.',  metaX, y,      { width:80 })
       .text('Date',         metaX, y+14,   { width:80 })
       .text('Status',       metaX, y+28,   { width:80 });
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
       .text(`INV-${invoiceNo}`, metaX+85, y,    { width:115, align:'right' })
       .text(date,               metaX+85, y+14, { width:115, align:'right' })
       .fillColor('#16A34A')
       .text('✓ PAID',           metaX+85, y+28, { width:115, align:'right' });

    // Divider
    y += 50;
    doc.moveTo(ML, y).lineTo(ML+CW, y).lineWidth(0.5).strokeColor(BORDER).stroke();

    // ── Bill To + Payment ID ──────────────────────────────────
    y += 12;
    const clientMode = process.env.CLIENT_MODE || 'Offline';

    doc.fillColor(GRAY).fontSize(7.5).font('Helvetica').text('BILL TO', ML, y);
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(client.company_name, ML, y+12);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text(client.admin_email || '', ML, y+26)
       .text(`Database: ${client.database_name || ''}`, ML, y+38);
    // Show client mode (Online/Offline)
    doc.fillColor(clientMode === 'Online' ? '#2563EB' : '#D97706')
       .fontSize(8).font('Helvetica-Bold')
       .text(`${clientMode} Client`, ML, y+52);

    doc.fillColor(GRAY).fontSize(7.5).font('Helvetica').text('PAYMENT ID', metaX, y);
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
       .text(paymentId, metaX, y+12, { width:200, align:'right' });

    // ── Table header ──────────────────────────────────────────
    y += 68;
    const col = { item:ML, qty:ML+280, price:ML+350, amt:ML+430 };

    doc.rect(ML, y, CW, 24).fill(PRIMARY);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
       .text('ITEM',       col.item+8,  y+8,  { width:260 })
       .text('QTY',        col.qty,     y+8,  { width:60,  align:'center' })
       .text('UNIT PRICE', col.price,   y+8,  { width:70,  align:'right' })
       .text('AMOUNT',     col.amt,     y+8,  { width:ML+CW-col.amt, align:'right' });

    // ── Table row ─────────────────────────────────────────────
    y += 24;
    doc.rect(ML, y, CW, 30).fill(LIGHT_BG);
    doc.rect(ML, y, CW, 30).lineWidth(0.3).strokeColor(BORDER).stroke();
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text(item, col.item+8, y+10, { width:260 });
    doc.font('Helvetica')
       .text(String(qty),            col.qty,   y+10, { width:60, align:'center' })
       .text(`Rs.${unitPrice}`,      col.price, y+10, { width:70, align:'right' })
       .font('Helvetica-Bold')
       .text(`Rs.${total.toLocaleString('en-IN')}`, col.amt, y+10, { width:ML+CW-col.amt, align:'right' });

    // ── GST Breakdown + Total row ────────────────────────────
    const baseAmt = Math.round(total / 1.18);
    const gstAmt  = total - baseAmt;

    y += 30;
    // Base amount row
    doc.rect(ML, y, CW, 22).fill(LIGHT_BG);
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
       .text('Base Amount', col.item+8, y+7, { width:350 });
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text(`Rs.${baseAmt.toLocaleString('en-IN')}`, col.amt, y+7, { width:ML+CW-col.amt, align:'right' });

    y += 22;
    // GST row
    doc.rect(ML, y, CW, 22).fill(LIGHT_BG);
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
       .text('GST (18%)', col.item+8, y+7, { width:350 });
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
       .text(`Rs.${gstAmt.toLocaleString('en-IN')}`, col.amt, y+7, { width:ML+CW-col.amt, align:'right' });

    y += 22;
    // Total row
    doc.rect(ML, y, CW, 36).fill('#E6FAF8');
    doc.rect(ML, y, CW, 36).lineWidth(1).strokeColor(PRIMARY).stroke();
    doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold')
       .text('TOTAL PAID (incl. GST)', col.item+8, y+12, { width:350 })
       .text(`Rs.${total.toLocaleString('en-IN')}`, col.amt, y+12, { width:ML+CW-col.amt, align:'right' });

    y += 36;
    // GST note
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('* GST @ 18% is included in the total amount', ML+8, y+4);

    // ── Updated Plan Details ──────────────────────────────────
    y += 50;
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text('Updated Plan Details', ML, y);
    doc.moveTo(ML, y+16).lineTo(ML+160, y+16).lineWidth(1.5).strokeColor(PRIMARY).stroke();

    const planRows = [
      ['Client Type',        `${clientMode} Client`],
      ['Displays Allocated', `${newPlan.displays} TVs`],
      ['Storage Allocated',  `${newPlan.storage} GB`],
      ['Subscription Valid Until', newPlan.subscriptionEnd],
    ];
    y += 24;
    planRows.forEach(([label, val], i) => {
      doc.rect(ML, y, CW, 20).fill(i%2===0 ? LIGHT_BG : 'white');
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(label, ML+8, y+6, { width:CW/2 });
      doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
         .text(val, ML+CW/2, y+6, { width:CW/2-8, align:'right' });
      y += 20;
    });

    // ── Footer ────────────────────────────────────────────────
    const footerY = PH - 55;
    doc.rect(0, footerY, PW, 55).fill(LIGHT_BG);
    doc.moveTo(0, footerY).lineTo(PW, footerY).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('IOTtech Smart Products Pvt. Ltd.  |  support@iottech.in  |  www.industrysop.com',
             ML, footerY+12, { align:'center', width:CW });
    doc.fillColor(GRAY).fontSize(7.5)
       .text('This is a system-generated invoice and does not require a signature.',
             ML, footerY+28, { align:'center', width:CW });

    doc.end();
  });
};