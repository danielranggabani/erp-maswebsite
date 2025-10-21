import * as React from 'react';

// Jenis data yang dibutuhkan untuk mengisi template SPK
interface SPKTemplateProps {
  spkNumber: string;
  clientName: string;
  projectName: string;
  scopeOfWork: string;
  totalPrice: number;
  paymentTerms: string;
  companyName: string;
  companyAddress: string;
  companyAccount: string;
  logoUrl?: string | null; 
  signatureUrl?: string | null; 
  todayDate: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const SPKTemplate: React.FC<SPKTemplateProps> = ({ 
  spkNumber,
  clientName,
  projectName,
  scopeOfWork,
  totalPrice,
  paymentTerms,
  companyName,
  companyAddress,
  companyAccount,
  logoUrl,
  signatureUrl,
  todayDate,
}) => {
  // Gunakan styling inline sederhana untuk kompatibilitas konversi PDF (Puppeteer)
  const styles = {
    container: { fontFamily: 'Arial, sans-serif', padding: '40px', fontSize: '12px', color: '#1f2937' as const },
    header: { textAlign: 'center' as const, marginBottom: '40px' },
    title: { fontSize: '20px', margin: '0', fontWeight: 'bold' as const },
    section: { marginBottom: '30px', border: '1px solid #e5e7eb', padding: '15px', borderRadius: '4px' },
    sectionTitle: { fontSize: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px', fontWeight: 'bold' as const },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    preWrap: { whiteSpace: 'pre-wrap' as const, lineHeight: '1.5', minHeight: '80px' },
    footer: { display: 'flex', justifyContent: 'space-between', marginTop: '50px' },
    signerBox: { textAlign: 'center' as const, width: '45%' },
    signatureSpace: { height: '80px', margin: '10px 0', borderBottom: '1px dashed #9ca3af' },
    image: { maxWidth: '150px', objectFit: 'contain' as const, margin: '10px auto' },
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        {logoUrl && (
          <img src={logoUrl} alt="Company Logo" style={{ ...styles.image, marginBottom: '10px' }} />
        )}
        <h1 style={styles.title}>SURAT PERJANJIAN KERJA (SPK)</h1>
        <p style={{ margin: '0', fontSize: '14px' }}>No: {spkNumber}</p>
        <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}>{companyAddress}</p>
      </header>

      <section style={{ marginBottom: '30px', border: '1px solid #e5e7eb', padding: '15px', borderRadius: '4px' }}>
        <h2 style={styles.sectionTitle}>DETAIL TRANSAKSI</h2>
        <div style={styles.grid}>
          <div><strong>Klien:</strong> {clientName}</div>
          <div><strong>Proyek:</strong> {projectName}</div>
          <div><strong>Harga Total:</strong> {formatCurrency(totalPrice)}</div>
          <div><strong>Tanggal Dibuat:</strong> {todayDate}</div>
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={styles.sectionTitle}>RUANG LINGKUP PEKERJAAN</h2>
        <p style={styles.preWrap}>{scopeOfWork}</p>
      </section>

      <section style={{ marginBottom: '50px' }}>
        <h2 style={styles.sectionTitle}>SYARAT & KETENTUAN PEMBAYARAN</h2>
        <p style={styles.preWrap}>{paymentTerms}</p>
        <div style={{ marginTop: '15px' }}>
            <strong>Rekening Pembayaran:</strong> {companyAccount}
        </div>
      </section>
      
      <footer style={styles.footer}>
        <div style={styles.signerBox}>
          <p>Klien Menyetujui,</p>
          <div style={styles.signatureSpace}></div>
          <p style={{ fontWeight: 'bold' }}>({clientName})</p>
        </div>
        <div style={styles.signerBox}>
          <p>Jakarta, {todayDate}</p>
          <p>Untuk dan atas nama {companyName},</p>
          {signatureUrl ? (
            <img 
              src={signatureUrl} 
              alt="Digital Signature" 
              style={{ ...styles.image, height: '80px', margin: '0 auto' }} 
            />
          ) : (
            <div style={styles.signatureSpace}></div>
          )}
          <p style={{ fontWeight: 'bold' }}>({companyName} - Admin)</p>
        </div>
      </footer>
    </div>
  );
};