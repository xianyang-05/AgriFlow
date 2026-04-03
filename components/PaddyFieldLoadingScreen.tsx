interface PaddyFieldLoadingScreenProps {
  title?: string
  description?: string
}

export default function PaddyFieldLoadingScreen({
  title = "Growing your recommendation",
  description = "The paddy field keeps growing from seedling to mature stalks until your plan is ready.",
}: PaddyFieldLoadingScreenProps) {
  const backRow = Array.from({ length: 8 }, (_, index) => index)
  const frontRow = Array.from({ length: 11 }, (_, index) => index)

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-4xl flex-col items-center justify-center gap-8">
        <div className="paddy-growth-loader" aria-hidden="true">
          <div className="paddy-growth-haze" />
          <div className="paddy-growth-row paddy-growth-row-back">
            {backRow.map((stalk, index) => (
              <div
                key={`back-${stalk}`}
                className="paddy-growth-stalk paddy-growth-stalk-back"
                style={{
                  left: `${8 + index * 11}%`,
                  animationDelay: `${index * 0.18}s`,
                }}
              >
                <span className="paddy-growth-blade" />
                <span className="paddy-growth-leaf paddy-growth-leaf-left" />
                <span className="paddy-growth-leaf paddy-growth-leaf-right" />
                <span className="paddy-growth-grain" />
              </div>
            ))}
          </div>
          <div className="paddy-growth-water" />
          <div className="paddy-growth-row paddy-growth-row-front">
            {frontRow.map((stalk, index) => (
              <div
                key={`front-${stalk}`}
                className="paddy-growth-stalk paddy-growth-stalk-front"
                style={{
                  left: `${4 + index * 8.7}%`,
                  animationDelay: `${index * 0.14}s`,
                }}
              >
                <span className="paddy-growth-blade" />
                <span className="paddy-growth-leaf paddy-growth-leaf-left" />
                <span className="paddy-growth-leaf paddy-growth-leaf-right" />
                <span className="paddy-growth-grain" />
              </div>
            ))}
          </div>
          <div className="paddy-growth-earth" />
        </div>

        <div className="max-w-lg space-y-3 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary/70">
            AgriFlow
          </p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}
