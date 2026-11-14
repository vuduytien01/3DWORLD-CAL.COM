/**
 * Hospital Demo Layout - Fullscreen, no default layout
 */

export const metadata = {
  title: 'Hospital 3D Demo - Cal.diy',
  description: 'Multi-floor hospital simulation with AI Guide integration',
};

export default function HospitalDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#EEF5F2' }}>
      {children}
    </main>
  );
}