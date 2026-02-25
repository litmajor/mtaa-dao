import { useEffect, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

/**
 * NEW DaoContextSelector Component (Week 1, Task 1.2d)
 * 
 * Sticky component that shows current DAO context
 * Allows users to switch between DAOs without losing place
 * Shows user's role in the DAO
 * 
 * Placement: Sticky, visible in header (top-right area)
 */

export interface DAO {
  id: string;
  name: string;
  avatar?: string;
  role: "member" | "proposer" | "admin" | "elder";
  treasury?: number; // in USD
}

export function DaoContextSelector() {
  const navigate = useNavigate();
  const [selectedDao, setSelectedDao] = useState<DAO | null>(null);
  const [daos, setDaos] = useState<DAO[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load user's DAOs on mount
  useEffect(() => {
    loadDaos();
  }, []);

  async function loadDaos() {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/users/my-daos");
      
      if (Array.isArray(response)) {
        setDaos(response);
        
        // Set selected DAO from localStorage, or first DAO
        const savedDaoId = localStorage.getItem("selectedDaoId");
        const selected = savedDaoId
          ? response.find(d => d.id === savedDaoId) || response[0]
          : response[0];
        
        if (selected) {
          setSelectedDao(selected);
          localStorage.setItem("selectedDaoId", selected.id);
        }
      }
    } catch (error) {
      console.error("Failed to load DAOs:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectDao(dao: DAO) {
    setSelectedDao(dao);
    localStorage.setItem("selectedDaoId", dao.id);
    setShowDropdown(false);
    
    // Optionally navigate to DAO detail page
    // navigate(`/daos/${dao.id}`);
  }

  function handleCreateDao() {
    setShowDropdown(false);
    navigate("/create-dao");
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dao-selector]")) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showDropdown]);

  if (loading || !selectedDao) {
    return null;
  }

  const roleColors: Record<string, string> = {
    admin: "bg-red-600",
    elder: "bg-purple-600",
    proposer: "bg-blue-600",
    member: "bg-green-600",
  };

  const roleEmoji: Record<string, string> = {
    admin: "👑",
    elder: "🧙",
    proposer: "📝",
    member: "👤",
  };

  return (
    <div data-dao-selector className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDropdown(!showDropdown)}
            className="text-slate-300 hover:text-white gap-2"
          >
            {/* DAO Avatar */}
            <div className="flex items-center gap-1.5">
              {selectedDao.avatar ? (
                <img
                  src={selectedDao.avatar}
                  alt={selectedDao.name}
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white">
                  {selectedDao.name.substring(0, 1)}
                </div>
              )}
              
              {/* DAO Name (hidden on mobile) */}
              <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
                {selectedDao.name}
              </span>
              
              {/* Role Badge */}
              <span
                className={`${roleColors[selectedDao.role]} text-white text-xs px-2 py-0.5 rounded-full font-medium`}
              >
                {roleEmoji[selectedDao.role]} {selectedDao.role}
              </span>
              
              <ChevronDown className="h-4 w-4 transition-transform" 
                style={{
                  transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)"
                }}
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Switch DAO context
        </TooltipContent>
      </Tooltip>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-bold text-white">My DAOs</h3>
            <p className="text-xs text-slate-400 mt-0.5">{daos.length} DAO{daos.length !== 1 ? 's' : ''}</p>
          </div>

          {/* DAO List */}
          <div className="divide-y divide-slate-700">
            {daos.map((dao) => (
              <button
                key={dao.id}
                onClick={() => handleSelectDao(dao)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                  selectedDao.id === dao.id ? "bg-slate-700" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* DAO Avatar */}
                  {dao.avatar ? (
                    <img
                      src={dao.avatar}
                      alt={dao.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white font-bold">
                      {dao.name.substring(0, 1)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">
                        {dao.name}
                      </p>
                      {selectedDao.id === dao.id && (
                        <span className="text-xs text-blue-400 font-bold">✓</span>
                      )}
                    </div>
                    
                    {/* Role + Treasury */}
                    <div className="flex items-center gap-2">
                      <span className={`${roleColors[dao.role]} text-white text-xs px-1.5 py-0.5 rounded`}>
                        {roleEmoji[dao.role]} {dao.role}
                      </span>
                      {dao.treasury !== undefined && (
                        <span className="text-xs text-slate-400">
                          ${dao.treasury.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Create New DAO Button */}
          <button
            onClick={handleCreateDao}
            className="w-full text-left px-4 py-3 bg-slate-700/50 hover:bg-slate-700 transition-colors text-blue-400 hover:text-blue-300 text-sm font-medium border-t border-slate-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New DAO
          </button>
        </div>
      )}
    </div>
  );
}
