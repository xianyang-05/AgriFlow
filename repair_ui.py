import sys

file_path = 'c:/Users/User/.gemini/antigravity/scratch/AgriFlow_upstream/app/dashboard/climate/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the whole bottom section of the Card
start_marker = '<div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(340px,1.15fr)] xl:items-start">'
end_marker = '</CardContent>'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx == -1 or end_idx < start_idx:
    print("Could not find blocks. Aborting.")
    sys.exit(1)

new_content = """<div className="grid gap-6 xl:grid-cols-[1fr_minmax(340px,1.15fr)] xl:items-start">
                <div className="space-y-6">
                  {/* First row */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200/80 bg-white/85 p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80">Coverage Status</div>
                      <div className="mt-3 text-2xl font-semibold text-foreground">
                        {floodRisk === "high" ? "Bind Now" : "Standby"}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {floodRisk === "high"
                          ? "Coverage should be secured before rainfall intensifies and exposure pricing worsens."
                          : "Insurance can stay on standby while conditions remain stable and exposure is limited."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-200/80 bg-white/85 p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/80">Uninsured Risk</div>
                      <div className="mt-3 text-2xl font-semibold text-foreground">
                        {floodRisk === "high" ? "35%" : "5%"}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Estimated uncovered loss up to <span className="font-semibold text-foreground">RM {floodRisk === "high" ? "12,500" : "1,800"}</span> if no protection is activated.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-200/80 bg-white/85 p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700/80">Payout Capacity</div>
                      <div className="mt-3 text-2xl font-semibold text-foreground">RM 3,000/ha</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Subsidized protection ceiling available for approved flood, drought, and pest-related losses.
                      </p>
                    </div>
                  </div>

                  {/* Second Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={`rounded-[1.75rem] border p-5 shadow-sm ${
                      floodRisk === "high"
                        ? "border-destructive/25 bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(255,255,255,0.9))]"
                        : "border-emerald-200/70 bg-[linear-gradient(135deg,rgba(240,253,244,0.95),rgba(255,255,255,0.92))]"
                    }`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                            floodRisk === "high" ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Insurable Event Trigger</div>
                            <h4 className="mt-1 text-lg font-semibold text-foreground">
                              {floodRisk === "high" ? "Coverage Action Recommended" : "Routine Monitoring"}
                            </h4>
                          </div>
                        </div>
                        <Badge className={`${
                          floodRisk === "high"
                            ? "border-destructive/25 bg-destructive/15 text-destructive"
                            : "border-emerald-300/60 bg-emerald-50 text-emerald-800"
                        }`}>
                          {floodRisk === "high" ? "High Exposure" : "Low Exposure"}
                        </Badge>
                      </div>
                      <p className={`mt-4 text-sm leading-relaxed ${
                        floodRisk === "high" ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {floodRisk === "high"
                            ? `Heavy rain expected (>${Math.max(...seasonalData.map((d) => d.rainfall), fallbackMaxRainfall).toFixed(0)}mm). This qualifies as a serious exposure window, so drainage action and insurance preparation should move in parallel.`
                            : "Standard rainfall expected. Keep monitoring weekly and keep policy documents ready for fast activation if conditions worsen."}
                      </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-sky-200/80 bg-[linear-gradient(145deg,rgba(239,246,255,0.96),rgba(255,255,255,0.92))] p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <Waves className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/80">Claims Readiness</div>
                          <h4 className="mt-1 text-lg font-semibold text-foreground">Field Protection Steps</h4>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-foreground">
                        {floodRisk === "high"
                          ? "Activate secondary pumps by mid-month, clear the main canal immediately, and keep field access open so inspection records and claims evidence can be captured quickly."
                          : "Maintain normal drainage operations and inspect canals after each rain event to keep the farm ready for fast intervention and documentation."}
                      </p>
                    </div>
                  </div>

                  {/* Third Row */}
                  <div className="rounded-[1.9rem] border border-emerald-200/80 bg-white/85 p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Uninsured Loss Exposure</div>
                        <h4 className="mt-2 text-2xl font-semibold text-foreground">Estimated Crop Exposure</h4>
                        <p className="mt-2 text-sm text-muted-foreground">
                          This combines forecast pressure with likely loss severity, helping determine whether insurance enrollment should be accelerated.
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm text-muted-foreground">Potential impact</div>
                        <div className="mt-1 text-3xl font-semibold text-destructive">
                          RM {floodRisk === "high" ? "12,500" : "1,800"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estimated exposure</span>
                        <span className="text-lg font-semibold text-destructive">{floodRisk === "high" ? "35%" : "5%"} at risk</span>
                      </div>
                      <Progress value={floodRisk === "high" ? 35 : 5} className="h-3 bg-muted" aria-label="Crop Loss Progress" />
                    </div>
                  </div>
                </div>

                <div className={`rounded-[1.75rem] border-2 bg-[linear-gradient(160deg,rgba(236,253,245,0.96),rgba(209,250,229,0.9))] p-5 shadow-[0_18px_45px_rgba(16,185,129,0.12)] transition-all duration-500 ${
                  floodRisk === "high" 
                    ? "border-emerald-400 ring-4 ring-emerald-500/20 shadow-[0_18px_45px_rgba(16,185,129,0.3)]" 
                    : "border-emerald-200/80"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Policy Summary</div>
                      <h4 className="mt-2 text-2xl font-semibold text-emerald-950">Agrobank STTP</h4>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
                        Prioritize enrollment now to reduce uninsured flood exposure, preserve cash flow, and shorten recovery time after a severe event.
                      </p>
                    </div>
                    <Badge className={`px-3 py-1 text-sm ${
                      floodRisk === "high"
                        ? "border-destructive/40 bg-destructive text-destructive-foreground animate-pulse shadow-lg shadow-destructive/30"
                        : "border-emerald-300/60 bg-white/70 text-emerald-800"
                    }`}>
                      {floodRisk === "high" ? "Critical - Protect Crop Now" : "Recommended"}
                    </Badge>
                  </div>

                  <div className="mt-5 rounded-[1.4rem] border border-emerald-300/40 bg-white/55 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/70">Policy Decision</span>
                      <span className="text-sm font-semibold text-emerald-950">
                        {floodRisk === "high" ? "Activate Before Next Rain Window" : "Keep Ready for Trigger Event"}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-emerald-100">
                      <div
                        className={`h-full rounded-full ${
                          floodRisk === "high" ? "w-[84%] bg-emerald-600" : "w-[42%] bg-emerald-500"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                      <span className="text-sm text-emerald-900/70">Estimated premium</span>
                      <span className="font-semibold text-foreground">RM 64.80 / ha</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                      <span className="text-sm text-emerald-900/70">Covered events</span>
                      <span className="font-semibold text-foreground">Flood, Drought, Pests</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                      <span className="text-sm text-emerald-900/70">Enrollment mode</span>
                      <span className="font-semibold text-foreground">Branch / PPK</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                      <span className="text-sm text-emerald-900/70">Claims readiness</span>
                      <span className="font-semibold text-foreground">Field Photos + Farm ID</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-[1.6rem] border border-emerald-300/40 bg-white/60 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/70">
                            Recommended Next Step
                          </div>
                          <p className="mt-1 text-sm text-emerald-950/80">
                            Start the coverage review flow now to secure protection before exposure rises further.
                          </p>
                        </div>
                        <div className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:block ${
                          floodRisk === "high" 
                            ? "bg-emerald-600 text-white animate-pulse shadow-md" 
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {floodRisk === "high" ? "URGENT ACTION" : "Primary Action"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="flex-1 relative group">
                          {floodRisk === "high" && (
                            <div className="absolute -inset-1 rounded-2xl bg-emerald-500 opacity-40 blur-lg group-hover:opacity-60 transition duration-500 animate-pulse"></div>
                          )}
                          <Button className={`relative w-full gap-3 rounded-2xl bg-[linear-gradient(135deg,#059669,#047857)] px-6 py-6 text-lg font-bold text-white shadow-[0_18px_40px_rgba(5,150,105,0.4)] transition-all hover:scale-[1.02] hover:bg-[linear-gradient(135deg,#047857,#065f46)] hover:shadow-[0_22px_48px_rgba(5,150,105,0.6)] ${floodRisk === "high" ? "animate-pulse" : ""}`}>
                            Explore Coverage Now
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Enroll in Agrobank STTP
                          </DialogTitle>
                          <DialogDescription>
                            High flood risk detected. Secure your crop with Malaysia's subsidized paddy insurance.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="rounded-lg bg-muted p-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Coverage</span>
                              <span className="font-medium">Flood, Drought, Pests</span>
                            </div>
                            <div className="mt-2 flex justify-between">
                              <span className="text-muted-foreground">Estimated Premium</span>
                              <span className="font-medium">RM 64.80 / ha</span>
                            </div>
                            <div className="mt-2 flex justify-between">
                              <span className="text-muted-foreground">Max Payout</span>
                              <span className="font-bold text-success">RM 3,000 / ha</span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            * Offline registration required at your nearest Agrobank branch or PPK.
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <InsurancePdfButton />
                          <Button variant="outline" onClick={() => window.open("https://www.agrobank.com.my", "_blank")} className="w-full">
                            Find Nearest Branch
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button variant="outline" onClick={() => window.open("https://www.agrobank.com.my", "_blank")} className="flex-1 rounded-2xl border-emerald-300/70 bg-white/80 py-6 text-emerald-900 hover:bg-emerald-50">
                      Find Nearest Branch
                    </Button>
                    </div>
                  </div>
                </div>
              </div>"""

final_content = content[:start_idx] + new_content + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(final_content)

print("Replacement complete.")
