import { connection } from "next/server";
import DemoHome from "@/components/DemoHome";
import { adminPasscode } from "@/lib/auth";
import { demoSite } from "@/lib/demo";

export default async function Home() {
  // Read the settings per request, so one build works with or without demo mode.
  await connection();
  // Only a demo site sends the passcode to the browser (see lib/demo.ts).
  return <DemoHome passcode={demoSite() ? adminPasscode() : null} />;
}
