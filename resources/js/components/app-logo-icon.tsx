export default function AppLogoIcon({ className }: { className?: string }) {
    return (
        <img src="/dcompc-logo.png" alt="DCOMPC Logo" className={`object-contain ${className ?? ''}`} />
    );
}
