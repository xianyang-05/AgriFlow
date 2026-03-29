"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Map, Wheat, Leaf, Carrot, Apple, Droplets, 
  ThermometerSun, Bug, AlertTriangle, CheckCircle2, X,
  ZoomIn, ZoomOut, Maximize2, Layers
} from "lucide-react"

interface FarmTile {
  id: string
  row: number
  col: number
  crop: string
  health: "excellent" | "good" | "warning" | "critical"
  cropIcon: typeof Wheat
  details: {
    plantedDate: string
    expectedHarvest: string
    soilMoisture: number
    lastIrrigation: string
    pestRisk: "low" | "medium" | "high"
    yieldEstimate: string
  }
}

const generateFarmGrid = (): FarmTile[] => {
  const crops = [
    { name: "Wheat", icon: Wheat },
    { name: "Rice", icon: Leaf },
    { name: "Vegetables", icon: Carrot },
    { name: "Fruits", icon: Apple },
  ]
  const healths: ("excellent" | "good" | "warning" | "critical")[] = ["excellent", "good", "warning", "critical"]
  const tiles: FarmTile[] = []

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const crop = crops[Math.floor(Math.random() * crops.length)]
      // Weighted health distribution - mostly good/excellent
      const healthIndex = Math.random() < 0.7 ? (Math.random() < 0.5 ? 0 : 1) : (Math.random() < 0.7 ? 2 : 3)
      tiles.push({
        id: `${row}-${col}`,
        row,
        col,
        crop: crop.name,
        health: healths[healthIndex],
        cropIcon: crop.icon,
        details: {
          plantedDate: "March 15, 2024",
          expectedHarvest: "July 20, 2024",
          soilMoisture: Math.floor(Math.random() * 40) + 40,
          lastIrrigation: "2 days ago",
          pestRisk: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as "low" | "medium" | "high",
          yieldEstimate: `${(Math.random() * 2 + 3).toFixed(1)} tons/acre`,
        },
      })
    }
  }
  return tiles
}

const farmTiles = generateFarmGrid()

const getHealthColor = (health: string) => {
  switch (health) {
    case "excellent":
      return "bg-success hover:bg-success/90 border-success/50"
    case "good":
      return "bg-primary hover:bg-primary/90 border-primary/50"
    case "warning":
      return "bg-warning hover:bg-warning/90 border-warning/50"
    case "critical":
      return "bg-destructive hover:bg-destructive/90 border-destructive/50"
    default:
      return "bg-muted border-border"
  }
}

const getHealthBadge = (health: string) => {
  switch (health) {
    case "excellent":
      return "bg-success/15 text-success border-success/30"
    case "good":
      return "bg-primary/15 text-primary border-primary/30"
    case "warning":
      return "bg-warning/15 text-warning-foreground border-warning/30"
    case "critical":
      return "bg-destructive/15 text-destructive border-destructive/30"
    default:
      return "bg-muted text-muted-foreground"
  }
}

const getPestBadge = (risk: string) => {
  switch (risk) {
    case "high":
      return "bg-destructive/15 text-destructive border-destructive/30"
    case "medium":
      return "bg-warning/15 text-warning-foreground border-warning/30"
    default:
      return "bg-success/15 text-success border-success/30"
  }
}

export default function FarmMapPage() {
  const [selectedTile, setSelectedTile] = useState<FarmTile | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)

  const healthCounts = {
    excellent: farmTiles.filter((t) => t.health === "excellent").length,
    good: farmTiles.filter((t) => t.health === "good").length,
    warning: farmTiles.filter((t) => t.health === "warning").length,
    critical: farmTiles.filter((t) => t.health === "critical").length,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Digital Farm Map</h1>
            <p className="text-sm text-muted-foreground">
              Interactive visualization of your farm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant={showLabels ? "default" : "outline"}
              size="icon"
              onClick={() => setShowLabels(!showLabels)}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Map Area */}
          <div className="xl:col-span-3">
            <Card className="shadow-lg shadow-primary/5 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" />
                    Farm Layout
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-success" />
                      <span className="text-xs text-muted-foreground">Excellent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">Good</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-warning" />
                      <span className="text-xs text-muted-foreground">Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-destructive" />
                      <span className="text-xs text-muted-foreground">Critical</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="overflow-auto p-4 bg-muted/30 rounded-xl"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                >
                  <div className="grid grid-cols-8 gap-2 min-w-[600px]">
                    {farmTiles.map((tile) => {
                      const Icon = tile.cropIcon
                      return (
                        <button
                          key={tile.id}
                          onClick={() => setSelectedTile(tile)}
                          className={`relative aspect-square rounded-xl border-2 transition-all duration-200 ${getHealthColor(tile.health)} ${
                            selectedTile?.id === tile.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
                          }`}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Icon className="h-6 w-6 mb-1" />
                            {showLabels && (
                              <span className="text-xs font-medium truncate px-1">
                                {tile.crop}
                              </span>
                            )}
                          </div>
                          {tile.health === "critical" && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive-foreground flex items-center justify-center">
                              <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Row Labels */}
                <div className="flex justify-between mt-4 px-4">
                  <span className="text-xs text-muted-foreground">Section A</span>
                  <span className="text-xs text-muted-foreground">Section B</span>
                  <span className="text-xs text-muted-foreground">Section C</span>
                  <span className="text-xs text-muted-foreground">Section D</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Tile Details or Overview */}
          <div className="space-y-6">
            {selectedTile ? (
              /* Selected Tile Details */
              <Card className="shadow-lg shadow-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Tile Details</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedTile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Crop Info */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getHealthColor(selectedTile.health)}`}>
                      <selectedTile.cropIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{selectedTile.crop}</p>
                      <Badge className={getHealthBadge(selectedTile.health)}>
                        {selectedTile.health}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-info" />
                        <span className="text-sm text-muted-foreground">Soil Moisture</span>
                      </div>
                      <span className="font-medium text-foreground">{selectedTile.details.soilMoisture}%</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Pest Risk</span>
                      </div>
                      <Badge className={getPestBadge(selectedTile.details.pestRisk)}>
                        {selectedTile.details.pestRisk}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Wheat className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Yield Est.</span>
                      </div>
                      <span className="font-medium text-foreground">{selectedTile.details.yieldEstimate}</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</p>
                    <div className="text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Planted</span>
                        <span className="text-foreground">{selectedTile.details.plantedDate}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Last Irrigation</span>
                        <span className="text-foreground">{selectedTile.details.lastIrrigation}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Expected Harvest</span>
                        <span className="text-primary font-medium">{selectedTile.details.expectedHarvest}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1">Irrigate</Button>
                    <Button size="sm" variant="outline" className="flex-1">Scan</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Overview Stats */
              <Card className="shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">Health Overview</CardTitle>
                  <CardDescription>Click a tile to see details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-success/10 border border-success/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium text-foreground">Excellent</span>
                      </div>
                      <span className="text-lg font-bold text-success">{healthCounts.excellent}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Good</span>
                      </div>
                      <span className="text-lg font-bold text-primary">{healthCounts.good}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-warning/10 border border-warning/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium text-foreground">Warning</span>
                      </div>
                      <span className="text-lg font-bold text-warning-foreground">{healthCounts.warning}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium text-foreground">Critical</span>
                      </div>
                      <span className="text-lg font-bold text-destructive">{healthCounts.critical}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Droplets className="h-4 w-4 text-info" />
                  Schedule Irrigation
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  Scan All for Pests
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <ThermometerSun className="h-4 w-4 text-warning" />
                  Check Soil Sensors
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
