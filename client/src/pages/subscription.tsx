import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Shield, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserDao {
  id: string;
  name: string;
  role?: string | null;
  plan?: string | null;
  memberCount?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export default function SubscriptionPage() {
  const navigate = useNavigate();

  const daosQuery = useQuery<UserDao[]>({
    queryKey: ["/api/daos"],
    queryFn: () => fetchJson<UserDao[]>("/api/daos")
  });

  const adminDaos = useMemo(() => {
    return (daosQuery.data || []).filter((dao) => dao.role === "admin");
  }, [daosQuery.data]);

  return (
    <div className="container mx-auto py-8 px-4" data-testid="subscription-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-subscription">
            <CreditCard className="w-8 h-8" />
            Subscription Management
          </h1>
          <p className="text-gray-600 mt-2">Choose an admin-managed DAO to upgrade its subscription tier.</p>
        </div>

        <Card data-testid="card-admin-daos">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              DAO Admin Access
            </CardTitle>
            <CardDescription>Only DAO admins can manage subscriptions.</CardDescription>
          </CardHeader>
          <CardContent>
            {daosQuery.isLoading && <p className="text-sm text-gray-600">Loading your DAOs...</p>}

            {daosQuery.isError && (
              <p className="text-sm text-red-600">{daosQuery.error.message}</p>
            )}

            {!daosQuery.isLoading && !adminDaos.length && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <p className="font-medium">No admin-managed DAOs found</p>
                <p className="text-sm mt-1">You must be a DAO admin to access subscription management.</p>
              </div>
            )}

            {!!adminDaos.length && (
              <div className="space-y-3">
                {adminDaos.map((dao) => (
                  <Button
                    key={dao.id}
                    variant="outline"
                    className="w-full h-auto justify-between p-4"
                    onClick={() => navigate(`/subscription/${dao.id}`)}
                    data-testid={`button-select-dao-${dao.id}`}
                  >
                    <span className="text-left">
                      <span className="font-semibold block">{dao.name}</span>
                      <span className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Users className="w-3 h-3" />
                        {dao.memberCount || 0} members
                      </span>
                    </span>
                    <Badge data-testid={`badge-plan-${dao.id}`}>
                      {dao.plan || "free"}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
