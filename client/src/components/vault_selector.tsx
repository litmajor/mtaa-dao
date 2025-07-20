// components/VaultSelector.tsx

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export function VaultSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [vaults, setVaults] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchVaults() {
      setLoading(true)
      try {
        const res = await fetch("/api/vaults/list")
        const json = await res.json()
        setVaults(json.vaults || [])
      } catch (e) {
        console.error("Error fetching vault list:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchVaults()
  }, [])

  return (
    <div className="text-sm">
      <label htmlFor="vault-select" className="block mb-1 font-medium">Select Vault</label>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <select
          id="vault-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("border rounded px-2 py-1 text-sm w-full", !value && "text-muted-foreground")}
        >
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name || v.id.slice(0, 10)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
