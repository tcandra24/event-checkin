import { getBroadcastHistory } from "@/app/actions/broadcast";
import { getPanitiaEmailMap } from "@/app/actions/participants";
import { RiwayatBroadcastClient } from "./RiwayatBroadcastClient";

export default async function RiwayatBroadcastPage() {
  const history = await getBroadcastHistory();
  const panitiaEmailMap = await getPanitiaEmailMap();

  return (
    <RiwayatBroadcastClient history={history} panitiaEmailMap={panitiaEmailMap} />
  );
}
