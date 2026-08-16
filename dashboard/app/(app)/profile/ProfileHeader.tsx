export function ProfileHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}
