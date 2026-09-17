import { Phone, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/rainvision/primitives";

const SOS_NUMBER = "112";

export default function SOSView() {
  return (
    <>
      <SectionHeading
        eyebrow="Emergency access"
        title="SOS"
        description="Quick emergency access remains available while RAIN VISION is monitoring or operating in offline backup mode."
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Siren size={19} className="text-rose-600" />
              Emergency SOS
            </CardTitle>
            <CardDescription>
              Tap to start an emergency call from a supported phone.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Emergency number
              </p>

              <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
                {SOS_NUMBER}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Keep this option available when immediate assistance is required.
              </p>

              <a href={`tel:${SOS_NUMBER}`} className="mt-5 inline-block">
                <Button
                  data-testid="button-sos-call"
                  size="lg"
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  <Phone size={16} />
                  Call {SOS_NUMBER}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Offline resilience</CardTitle>
            <CardDescription>
              SOS remains visible even when live data requests are paused.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              When connectivity is lost, RAIN VISION automatically switches to
              offline backup and keeps the latest known local data available.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
