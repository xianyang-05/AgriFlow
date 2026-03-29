"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Search, Bell, ChevronDown, Droplets, Wind, Sparkles,
  TrendingUp
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import Image from "next/image"

const moistureData = [
  { month: "Apr", value: 8 },
  { month: "May", value: 12 },
  { month: "Jun", value: 6 },
  { month: "Jul", value: 15 },
  { month: "Aug", value: 10 },
  { month: "Sep", value: 18 },
  { month: "Oct", value: 14 },
]

const nutrients = [
  { symbol: "Mg", name: "Magnesium", range: "0.20 - 0.30", value: "0.15%", color: "bg-amber-500", progress: 50 },
  { symbol: "pH", name: "Acidity", range: "5.5 - 7.5", value: "3.2 pH", color: "bg-emerald-500", progress: 45 },
  { symbol: "P", name: "Phosphorus", range: "0.10 - 0.30", value: "0.8%", color: "bg-cyan-500", progress: 80 },
  { symbol: "K", name: "Potassium", range: "110-280", value: "180 kg", color: "bg-green-600", progress: 65 },
  { symbol: "C", name: "Organic carbon", range: "0.5 - 7.5", value: "0.7%", color: "bg-teal-500", progress: 35 },
]

// Circular Progress Component
function CircularProgress({ 
  value, 
  max, 
  label, 
  unit,
  color = "#22c55e",
  size = 90
}: { 
  value: number
  max: number
  label: string
  unit: string
  color?: string
  size?: number
}) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = ((max - value) / max) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#1a1a1a]">{value}</span>
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-gray-600 mt-2">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("Dashboard")
  const tabs = ["Dashboard", "Harvest", "Customization", "Settings"]

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#f5f0e8]/95 backdrop-blur-sm">
        <div className="px-8 h-16 flex items-center justify-between">
          <nav className="flex items-center gap-8">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium transition-colors ${
                  activeTab === tab 
                    ? "text-[#1a1a1a]" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-white/50 transition-colors">
              <Search className="h-5 w-5 text-gray-600" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/50 transition-colors relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>
            <Button className="bg-[#c41e3a] hover:bg-[#a01830] text-white rounded-full px-4 h-9">
              + Add Member
            </Button>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Top Row - Soil Analysis & Moisture Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Soil Analysis Card */}
          <Card className="lg:col-span-3 bg-gradient-to-br from-[#8b7355] to-[#6b5344] border-0 overflow-hidden relative">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">Soil analysis</h3>
                  <p className="text-white/60 text-sm">Jun, 2023</p>
                </div>
                <Badge className="bg-[#c41e3a] text-white border-0 rounded-full">
                  +0.7% pH
                </Badge>
              </div>
              
              {/* 3D Soil Visualization */}
              <div className="relative h-48 flex items-end justify-center">
                {/* Depth markers */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-white/60 text-xs py-4">
                  <span>1.3m</span>
                  <span>0.7m</span>
                  <span>-1.2m</span>
                </div>
                
                {/* Soil layers illustration */}
                <div className="relative w-64 h-40">
                  {/* Top grass layer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-gradient-to-b from-green-500 to-green-600 rounded-t-lg transform perspective-500 rotate-x-12 shadow-lg">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzIyYzU1ZSIvPgo8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyIiBmaWxsPSIjMTZhMzRhIi8+Cjwvc3ZnPg==')] opacity-30 rounded-t-lg" />
                    {/* pH indicator on top */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full px-2 py-1 text-xs font-medium shadow-md">
                      pH 5.7%
                    </div>
                  </div>
                  
                  {/* Brown soil layer */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 w-52 h-16 bg-gradient-to-b from-[#8B4513] to-[#654321] transform skew-y-2 shadow-lg" />
                  
                  {/* Darker soil layer */}
                  <div className="absolute top-24 left-1/2 -translate-x-1/2 w-56 h-16 bg-gradient-to-b from-[#654321] to-[#3d2817] transform skew-y-1 shadow-lg">
                    {/* pH indicator in middle */}
                    <div className="absolute top-2 right-4 bg-white rounded-full px-2 py-1 text-xs font-medium shadow-md">
                      pH 2%
                    </div>
                  </div>
                </div>
                
                <span className="absolute bottom-2 right-4 text-white/60 text-xs">Details</span>
              </div>
            </CardContent>
          </Card>

          {/* Soil Moisture Levels Card */}
          <Card className="lg:col-span-2 bg-[#f5f0e8] border border-[#e5ddd0] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#1a1a1a] font-semibold">Soil moisture levels</h3>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>0%</span>
                  <span>10%</span>
                  <span>20%</span>
                  <span>30%</span>
                  <span>40%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: "35%" }}
                  />
                </div>
              </div>
              
              {/* Circular Gauges */}
              <div className="flex items-center justify-around mt-6">
                <CircularProgress 
                  value={101.3} 
                  max={150} 
                  label="Pressure" 
                  unit="kPa"
                  color="#1a1a1a"
                />
                <CircularProgress 
                  value={8} 
                  max={20} 
                  label="Wind" 
                  unit="m/s"
                  color="#22c55e"
                />
                <CircularProgress 
                  value={42} 
                  max={100} 
                  label="Air quality" 
                  unit="AQI"
                  color="#06b6d4"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - Nutrients & Moisture Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Nutrients Levels */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#1a1a1a] font-semibold">Nutrients levels (per hectare)</h3>
                <button className="text-sm text-gray-500 hover:text-gray-700">See more</button>
              </div>
              
              <div className="space-y-4">
                {nutrients.map((nutrient) => (
                  <div key={nutrient.symbol} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg ${nutrient.color} flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{nutrient.symbol}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#1a1a1a]">{nutrient.name}</span>
                        <span className="text-sm text-gray-500">{nutrient.value}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Droplets className="h-3 w-3" />
                          {nutrient.range}
                        </span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${nutrient.color} rounded-full transition-all duration-500`}
                            style={{ width: `${nutrient.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Moisture Chart & Growing Flow */}
          <div className="space-y-6">
            {/* Soil Moisture Chart */}
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#1a1a1a] font-semibold">Soil moisture levels</h3>
                  <button className="text-sm text-gray-500 hover:text-gray-700">Details</button>
                </div>
                
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={moistureData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        domain={[0, 20]}
                        ticks={[0, 10, 20]}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#22c55e" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Max indicator */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">20 Max</span>
                  <div className="flex-1 border-t border-dashed border-gray-300" />
                </div>
              </CardContent>
            </Card>

            {/* Growing Flow Card */}
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 overflow-hidden relative">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-lg">Growing flow</h3>
                    <p className="text-white/70 text-sm">During May, 2023</p>
                    
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-medium">Phase 2</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">Broccoli</span>
                    <ChevronDown className="h-4 w-4 text-white" />
                  </div>
                </div>
                
                {/* Plant illustration placeholder */}
                <div className="absolute bottom-0 right-0 w-40 h-40 opacity-90">
                  <div className="relative w-full h-full">
                    {/* Stylized broccoli/plant shape */}
                    <div className="absolute bottom-4 right-8 w-20 h-20 bg-emerald-400/50 rounded-full blur-sm" />
                    <div className="absolute bottom-8 right-12 w-16 h-16 bg-emerald-300/60 rounded-full" />
                    <div className="absolute bottom-2 right-16 w-2 h-16 bg-emerald-700/40 rounded-full" />
                    
                    {/* Growth arc */}
                    <svg className="absolute bottom-0 right-0 w-40 h-40" viewBox="0 0 100 100">
                      <path
                        d="M 80 90 Q 50 20 20 90"
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        opacity="0.5"
                      />
                      <circle cx="50" cy="50" r="4" fill="white" opacity="0.8" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
