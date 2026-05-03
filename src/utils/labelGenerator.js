const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const bwipjs = require('bwip-js');

/**
 * Generates a PDF label for a shipment.
 * @param {object} shipment 
 * @returns {Promise<string>} Path to the generated PDF file.
 */
const generateLabel = async (shipment) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [283, 425], margin: 10 }); // 4x6 inches approx
      const fileName = `label_${shipment.tracking_id}.pdf`;
      const filePath = path.join(__dirname, '../../uploads/labels', fileName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(16).text('COURIER SYSTEM', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Tracking ID: ${shipment.tracking_id}`, { align: 'center' });
      doc.moveDown(1);

      // Barcode
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: shipment.tracking_id,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });
      doc.image(barcodeBuffer, { fit: [260, 100], align: 'center' });
      doc.moveDown(1);

      // Sender/Receiver Info
      doc.fontSize(12).text('FROM:', { underline: true });
      doc.fontSize(10).text(`${shipment.sender_name}\n${shipment.sender_phone}\n${shipment.sender_address}`);
      doc.moveDown(1);

      doc.fontSize(12).text('TO:', { underline: true });
      doc.fontSize(10).text(`${shipment.receiver_name}\n${shipment.receiver_phone}\n${shipment.receiver_address}`);
      doc.moveDown(1);

      // Additional Info
      doc.rect(10, doc.y, 260, 60).stroke();
      doc.fontSize(12).text(`COD: ${shipment.payment_type === 'COD' ? 'Rs. ' + shipment.cod_amount : 'PREPAID'}`, 20, doc.y + 10);
      doc.text(`Weight: ${shipment.weight}kg`, 150, doc.y - 12);
      doc.text(`Parcel Type: ${shipment.parcel_type || 'N/A'}`, 20, doc.y + 10);

      doc.end();

      stream.on('finish', () => resolve(fileName));
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateLabel };
