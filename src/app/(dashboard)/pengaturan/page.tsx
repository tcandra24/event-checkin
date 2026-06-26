import { getEventSettings } from "@/app/actions/eventSettings";
import { PengaturanClient } from "./PengaturanClient";

export default async function PengaturanPage() {
  const settings = await getEventSettings();

  return <PengaturanClient initialSettings={settings} />;
}
