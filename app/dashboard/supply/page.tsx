"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Package, Wheat, Leaf, Carrot, Apple, TrendingUp, 
  Store, Truck, Warehouse, DollarSign, Users, ShoppingCart,
  ArrowRight, Plus, BarChart3, History
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const surplusCrops = [
  {
    id: 1,
    name: "Wheat",
    icon: Wheat,
    quantity: "45 tons",
    status: "ready",
    price: "$280/ton",
    totalValue: "$12,600",
    harvestDate: "June 15, 2024",
    quality: "Grade A",
  },
  {
    id: 2,
    name: "Rice",
    icon: Leaf,
    quantity: "32 tons",
    status: "ready",
    price: "$350/ton",
    totalValue: "$11,200",
    harvestDate: "June 20, 2024",
    quality: "Premium",
  },
  {
    id: 3,
    name: "Vegetables",
    icon: Carrot,
    quantity: "18 tons",
    status: "processing",
    price: "$450/ton",
    totalValue: "$8,100",
    harvestDate: "June 10, 2024",
    quality: "Fresh",
  },
  {
    id: 4,
    name: "Fruits",
    icon: Apple,
    quantity: "12 tons",
    status: "stored",
    price: "$520/ton",
    totalValue: "$6,240",
    harvestDate: "June 5, 2024",
    quality: "Organic",
  },
]

const distributionData = [
  { name: "Local Markets", value: 35, color: "var(--color-primary)" },
  { name: "Wholesale", value: 30, color: "var(--color-chart-2)" },
  { name: "Direct Sales", value: 20, color: "var(--color-chart-3)" },
  { name: "Storage", value: 15, color: "var(--color-chart-4)" },
]

const revenueData = [
  { month: "Jan", revenue: 12500, target: 15000 },
  { month: "Feb", revenue: 14200, target: 15000 },
  { month: "Mar", revenue: 18500, target: 16000 },
  { month: "Apr", revenue: 16800, target: 16000 },
  { month: "May", revenue: 21200, target: 18000 },
  { month: "Jun", revenue: 24500, target: 20000 },
]

const recentTransactions = [
  {
    id: 1,
    type: "sale",
    crop: "Wheat",
    quantity: "10 tons",
    amount: "$2,800",
    buyer: "Green Valley Market",
    date: "Today",
  },
  {
    id: 2,
    type: "sale",
    crop: "Rice",
    quantity: "8 tons",
    amount: "$2,800",
    buyer: "Metro Foods",
    date: "Yesterday",
  },
  {
    id: 3,
    type: "distribute",
    crop: "Vegetables",
    quantity: "5 tons",
    amount: "Donated",
    buyer: "Community Food Bank",
    date: "2 days ago",
  },
  {
    id: 4,
    type: "store",
    crop: "Fruits",
    quantity: "12 tons",
    amount: "-",
    buyer: "Cold Storage A",
    date: "3 days ago",
  },
]

const getStatusBadge = (status: string) => {
  switch (status) {
    case "ready":
      return "bg-success/15 text-success border-success/30"
    case "processing":
      return "bg-warning/15 text-warning-foreground border-warning/30"
    case "stored":
      return "bg-info/15 text-info border-info/30"
    default:
      return "bg-muted text-muted-foreground"
  }
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "sale":
      return <DollarSign className="h-4 w-4 text-success" />
    case "distribute":
      return <Users className="h-4 w-4 text-info" />
    case "store":
      return <Warehouse className="h-4 w-4 text-muted-foreground" />
    default:
      return <Package className="h-4 w-4" />
  }
}

export default function SupplyPage() {
  const [selectedCrop, setSelectedCrop] = useState<typeof surplusCrops[0] | null>(null)

  const totalValue = surplusCrops.reduce((acc, crop) => {
    return acc + parseFloat(crop.totalValue.replace(/[$,]/g, ""))
  }, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Supply & Output</h1>
            <p className="text-sm text-muted-foreground">
              Manage surplus crops and distribution
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Inventory
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-lg shadow-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <Badge className="bg-success/15 text-success border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12%
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Total Surplus</p>
                <p className="text-2xl font-bold text-foreground">107 tons</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg shadow-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-foreground">${totalValue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg shadow-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-info/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-info" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Active Buyers</p>
                <p className="text-2xl font-bold text-foreground">24</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg shadow-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-warning" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Pending Deliveries</p>
                <p className="text-2xl font-bold text-foreground">8</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Surplus Crops */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Surplus Inventory
                </CardTitle>
                <CardDescription>Available crops for sale or distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {surplusCrops.map((crop) => {
                    const Icon = crop.icon
                    return (
                      <div
                        key={crop.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                          selectedCrop?.id === crop.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedCrop(crop)}
                      >
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">{crop.name}</h3>
                            <Badge className={getStatusBadge(crop.status)}>
                              {crop.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{crop.quantity}</span>
                            <span>{crop.quality}</span>
                            <span className="text-primary font-medium">{crop.price}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{crop.totalValue}</p>
                          <p className="text-xs text-muted-foreground">Total Value</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            {selectedCrop ? (
              <Card className="shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">Actions for {selectedCrop.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start gap-2 h-12">
                    <ShoppingCart className="h-4 w-4" />
                    Sell to Market
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-12">
                    <Users className="h-4 w-4" />
                    Distribute to Community
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 h-12">
                    <Warehouse className="h-4 w-4" />
                    Store for Later
                  </Button>
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Quick Info</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Harvest Date</span>
                        <span className="text-foreground">{selectedCrop.harvestDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quality</span>
                        <span className="text-foreground">{selectedCrop.quality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Market Price</span>
                        <span className="text-primary font-medium">{selectedCrop.price}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg shadow-primary/5">
                <CardContent className="p-6 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Select a crop to see actions</p>
                </CardContent>
              </Card>
            )}

            {/* Distribution Chart */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Distribution Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {distributionData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue and Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card className="shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Monthly revenue vs target</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                    />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar dataKey="target" fill="var(--color-muted)" radius={[4, 4, 0, 0]} name="Target" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-muted" />
                  <span className="text-sm text-muted-foreground">Target</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/50"
                  >
                    <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center border border-border">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{tx.crop}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-sm text-muted-foreground">{tx.quantity}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{tx.buyer}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "sale" ? "text-success" : "text-foreground"}`}>
                        {tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 gap-2">
                View All Transactions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
