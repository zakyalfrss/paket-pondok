const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../database');
const fs = require('fs');
const path = require('path');

class ReportService {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async generateExcelLaporan(tanggal_awal, tanggal_akhir, type = 'mingguan') {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Laporan Paket');

            worksheet.columns = [
                { header: 'No', key: 'no', width: 5 },
                { header: 'Tanggal Datang', key: 'tanggal_datang', width: 15 },
                { header: 'Kamar', key: 'kamar', width: 15 },
                { header: 'Pembimbing', key: 'pembimbing', width: 20 },
                { header: 'Pengirim', key: 'pengirim', width: 20 },
                { header: 'Penerima', key: 'penerima', width: 20 },
                { header: 'Jenis Barang', key: 'jenis_barang', width: 15 },
                { header: 'Status', key: 'status', width: 10 },
                { header: 'Kondisi', key: 'kondisi', width: 12 },
                { header: 'Tanggal Diambil', key: 'tanggal_diambil', width: 15 },
                { header: 'Catatan', key: 'catatan', width: 25 }
            ];

            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '4472C4' }
            };

            let data;
            if (type === 'mingguan') {
                data = await db.getLaporanMingguan(tanggal_awal, tanggal_akhir);
            } else {
                data = await db.getLaporanBulanan(parseInt(tanggal_awal), parseInt(tanggal_akhir));
            }

            data.forEach((item, index) => {
                worksheet.addRow({
                    no: index + 1,
                    tanggal_datang: new Date(item.tanggal_datang).toLocaleDateString('id-ID'),
                    kamar: item.nama_kamar,
                    pembimbing: item.nama_pembimbing,
                    pengirim: item.nama_pengirim,
                    penerima: item.nama_penerima,
                    jenis_barang: item.jenis_barang,
                    status: item.status,
                    kondisi: item.kondisi,
                    tanggal_diambil: item.tanggal_diambil ? 
                        new Date(item.tanggal_diambil).toLocaleDateString('id-ID') : '-',
                    catatan: item.catatan || '-'
                });
            });

            worksheet.autoFilter = 'A1:K1';

            const filename = `laporan_paket_${type}_${tanggal_awal}_${tanggal_akhir}.xlsx`;
            const filepath = path.join(this.tempDir, filename);

            await workbook.xlsx.writeFile(filepath);
            return filepath;

        } catch (error) {
            console.error('Error generating Excel:', error);
            throw error;
        }
    }

    async generatePDFLaporan(tanggal_awal, tanggal_akhir, type = 'mingguan') {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const filename = `laporan_paket_${type}_${tanggal_awal}_${tanggal_akhir}.pdf`;
                const filepath = path.join(this.tempDir, filename);

                const stream = fs.createWriteStream(filepath);
                doc.pipe(stream);

                let data;
                if (type === 'mingguan') {
                    data = await db.getLaporanMingguan(tanggal_awal, tanggal_akhir);
                } else {
                    data = await db.getLaporanBulanan(parseInt(tanggal_awal), parseInt(tanggal_akhir));
                }

                doc.fontSize(20).text('LAPORAN PAKET PONDOK', { align: 'center' });
                doc.fontSize(12).text(`Periode: ${tanggal_awal} s/d ${tanggal_akhir}`, { align: 'center' });
                doc.moveDown();

                if (data.length === 0) {
                    doc.fontSize(14).text('Tidak ada data untuk periode ini', { align: 'center' });
                    doc.end();
                    stream.on('finish', () => resolve(filepath));
                    return;
                }

                let yPosition = doc.y;
                const startX = 50;
                const colWidths = [30, 80, 60, 80, 80, 60, 40, 50, 80];

                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('No', startX, yPosition);
                doc.text('Tanggal', startX + colWidths[0], yPosition);
                doc.text('Kamar', startX + colWidths[0] + colWidths[1], yPosition);
                doc.text('Penerima', startX + colWidths[0] + colWidths[1] + colWidths[2], yPosition);
                doc.text('Jenis', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition);

                yPosition += 20;
                doc.moveTo(startX, yPosition).lineTo(startX + 500, yPosition).stroke();

                doc.font('Helvetica').fontSize(8);
                data.forEach((item, index) => {
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 50;
                    }

                    yPosition += 15;
                    doc.text((index + 1).toString(), startX, yPosition);
                    doc.text(new Date(item.tanggal_datang).toLocaleDateString('id-ID'), startX + colWidths[0], yPosition);
                    doc.text(item.nama_kamar, startX + colWidths[0] + colWidths[1], yPosition);
                    doc.text(item.nama_penerima, startX + colWidths[0] + colWidths[1] + colWidths[2], yPosition);
                    doc.text(item.jenis_barang, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition);
                });

                doc.end();

                stream.on('finish', () => resolve(filepath));
                stream.on('error', reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    cleanupTempFiles() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;

                files.forEach(file => {
                    const filepath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filepath);
                    if (now - stats.mtime.getTime() > oneHour) {
                        fs.unlinkSync(filepath);
                    }
                });
            }
        } catch (error) {
            console.error('Error cleaning temp files:', error);
        }
    }
}

module.exports = ReportService;