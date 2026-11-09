import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Qui est-ce ?</h1>
      <p className="text-muted-foreground">Le jeu classique, en ligne.</p>
      <Link
        href="/solo"
        className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
      >
        Jouer en solo contre l&apos;IA
      </Link>
    </main>
  );
}
