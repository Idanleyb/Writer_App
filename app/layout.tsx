export const metadata = {
  title: 'Articles Builder',
  description: 'AI-assisted article ideation and writing, tuned to your topics and tone.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0b1220', color: '#eef2f8' }}>
        {children}
      </body>
    </html>
  );
}
