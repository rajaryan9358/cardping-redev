import { notFound } from "next/navigation";
import { CardDetailClient } from "./CardDetailClient";
import { allTags, getCard, getCards, getInteractions, getVoiceNotes } from "@/lib/data/cards";

export default async function CardDetailPage({ params }: { params: { cardId: string } }) {
  const card = await getCard(params.cardId);
  if (!card) notFound();
  const [interactions, voiceNotes, everyCard] = await Promise.all([
    getInteractions(card.id),
    getVoiceNotes(card.id),
    getCards(),
  ]);
  return <CardDetailClient card={card} interactions={interactions} voiceNotes={voiceNotes} allTags={allTags(everyCard)} />;
}
