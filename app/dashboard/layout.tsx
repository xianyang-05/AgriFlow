"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { 
  Leaf, LayoutDashboard, Bug, CloudSun,
  Settings, HelpCircle, LogOut, Bell, Droplets, Snowflake,
  Activity, Radio, Play, Plus, ChevronLeft, ChevronRight
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pest Detection", href: "/dashboard/pest", icon: Bug },
  { name: "Climate & Risk", href: "/dashboard/climate", icon: CloudSun },
]

const shortcuts = [
  { name: "Alerts", icon: Bell, updated: "UPD 12.08" },
  { name: "Irrigation", icon: Droplets, updated: "UPD 19.02" },
  { name: "Soil Health", icon: Activity, updated: "UPD 11.04" },
  { name: "Sensors", icon: Radio, updated: "UPD 13.04" },
  { name: "Scenes", icon: Play, updated: "UPD 24.01" },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [autoIrrigation, setAutoIrrigation] = useState(true)
  const [frostProtection, setFrostProtection] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex">
      {/* Dark Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 bg-[#0f5132] ${isCollapsed ? "w-16" : "w-56"}`}>
        {/* Header: Logo & Toggle */}
        <div className={`flex flex-col shrink-0 transition-all duration-300 ${isCollapsed ? "items-center py-6 gap-6" : "px-4 pt-6 pb-4"}`}>
          <div className={`flex items-center transition-all duration-300 ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-full shadow-lg" />
              {!isCollapsed && <span className="font-bold text-white tracking-tight text-lg">AGRIFLOW</span>}
            </Link>
            
            {!isCollapsed && (
              <button 
                suppressHydrationWarning 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button 
              suppressHydrationWarning 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="p-1.5 rounded-lg hover:bg-white/20 transition-all bg-white/10 border border-white/20 shadow-sm"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        {/* Auto Scenes Section */}
        {!isCollapsed && (
          <div className="px-4 py-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/90 text-sm font-medium">Auto scenes</span>
              <span className="text-white/50 text-xs">Details</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <Droplets className="h-4 w-4 text-white/70" />
                  <span className="text-white/90 text-sm">Auto irrigation</span>
                </div>
                <Switch 
                  checked={autoIrrigation} 
                  onCheckedChange={setAutoIrrigation}
                  className="data-[state=checked]:bg-[#22c55e]"
                />
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <Snowflake className="h-4 w-4 text-white/70" />
                  <span className="text-white/90 text-sm">Frost Protection</span>
                </div>
                <Switch 
                  checked={frostProtection} 
                  onCheckedChange={setFrostProtection}
                  className="data-[state=checked]:bg-[#22c55e]"
                />
              </div>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="py-4 flex flex-col items-center gap-4 shrink-0 border-b border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Droplets className="h-4 w-4 text-white/70" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Snowflake className="h-4 w-4 text-white/70" />
            </div>
          </div>
        )}



        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto mt-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#22c55e] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={item.name}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Section */}
        <div className={`p-3 border-t border-white/10 flex items-center shrink-0 ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between"}`}>
          <button suppressHydrationWarning className="p-2 rounded-lg hover:bg-white/10 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
            <LogOut className="h-4 w-4 text-white/60" />
          </button>
          {!isCollapsed && (
            <>
              <button suppressHydrationWarning className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <HelpCircle className="h-4 w-4 text-white/60" />
              </button>
              <button suppressHydrationWarning className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <Settings className="h-4 w-4 text-white/60" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? "ml-16" : "ml-56"}`}>
        {children}
      </main>
    </div>
  )
}
