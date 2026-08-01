import './globals.css';

export const metadata = {
  title: 'Articles Builder',
  description: 'AI-assisted article and LinkedIn post writing, tuned to your topics and tone.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="soft-field" aria-hidden="true">
          <div className="soft-blob b1" />
          <div className="soft-blob b2" />
        </div>
        <div className="surface">{children}</div>
      </body>
    </html>
  );
}
