import { notFound } from "next/navigation";
import { EditLeadClient } from "./EditLeadClient";
import { getCard } from "@/lib/data/cards";

export default async function EditLeadPage({ params }: { params: { cardId: string } }) {
  const card = await getCard(params.cardId);
  if (!card) notFound();
  return <EditLeadClient card={card} />;
}
