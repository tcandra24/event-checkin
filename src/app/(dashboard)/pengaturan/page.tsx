import { getEventSettings, listTicketBackgrounds } from "@/app/actions/eventSettings";
import { PengaturanClient } from "./PengaturanClient";

export default async function PengaturanPage() {
  const settings = await getEventSettings();
  const backgroundGallery = await listTicketBackgrounds();

  return <PengaturanClient initialSettings={settings} initialGallery={backgroundGallery} />;
}
