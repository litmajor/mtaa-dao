import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDaoContext } from "@/contexts/dao-context";

/**
 * Sticky DAO selector shown in the global nav.
 * It reads from the shared DAO context so the selected DAO stays consistent
 * across dashboard, settings, and DAO-specific pages.
 */
export function DaoContextSelector() {
  const navigate = useNavigate();
  const { daos, selectedDao, selectedDaoId, selectDao, isLoading } = useDaoContext();
  const [showDropdown, setShowDropdown] = useState(false);

  const roleBadgeClass = useMemo(() => {
    switch (selectedDao?.role) {
      case 'admin':
        return 'bg-red-600';
      case 'elder':
        return 'bg-purple-600';
      case 'proposer':
        return 'bg-blue-600';
      default:
        return 'bg-green-600';
    }
  }, [selectedDao?.role]);

  const handleSelectDao = (daoId: string) => {
    selectDao(daoId);
    setShowDropdown(false);
    navigate(`/dao/${daoId}`);
  };

  const handleCreateDao = () => {
    setShowDropdown(false);
    navigate("/create-dao");
  };

  if (isLoading || !selectedDao) {
    return null;
  }

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
            <div className="flex items-center gap-2">
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

              <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
                {selectedDao.name}
              </span>

              <span className={`${roleBadgeClass} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
                {selectedDao.role}
              </span>

              <ChevronDown
                className="h-4 w-4 transition-transform"
                style={{
                  transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Switch DAO context
        </TooltipContent>
      </Tooltip>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-bold text-white">My DAOs</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {daos.length} DAO{daos.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="divide-y divide-slate-700">
            {daos.map((dao) => (
              <button
                key={dao.id}
                onClick={() => handleSelectDao(dao.id)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                  selectedDaoId === dao.id ? "bg-slate-700" : ""
                }`}
              >
                <div className="flex items-center gap-3">
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
                      {selectedDaoId === dao.id && (
                        <span className="text-xs text-blue-400 font-bold">Selected</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`${roleBadgeClass} text-white text-xs px-1.5 py-0.5 rounded`}>
                        {dao.role}
                      </span>
                      {dao.treasuryUSD !== undefined && (
                        <span className="text-xs text-slate-400">
                          ${dao.treasuryUSD.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

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

export default DaoContextSelector;
