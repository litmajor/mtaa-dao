import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { CreditCard, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDao, setSelectedDao] = useState<string | null>(null);

  const { data: userDaos } = useQuery({
    queryKey: ["/api/user/daos"],
    enabled: !!user
  });

  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription", selectedDao],
    enabled: !!selectedDao
  });

  const upgradeMutation = useMutation({
    mutationFn: async (daoId: string) => {
      return await apiRequest(`/api/subscription/upgrade`, {
        method: "POST",
        body: JSON.stringify({
          daoId,
          userId: user?.id,
          plan: "premium",
          paymentMethod: "stripe"
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Success",
        description: "Successfully upgraded to Premium!"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upgrade subscription",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="container mx-auto py-8 px-4" data-testid="subscription-page">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" data-testid="heading-subscription">Subscription Management</h1>

        {/* Current Plan */}
        <Card className="mb-6" data-testid="card-current-plan">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Manage your DAO subscriptions and billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDao ? (
              <div>
                <p className="text-sm text-gray-600 mb-4">Select a DAO to manage its subscription:</p>
                <div className="space-y-2">
                  {userDaos?.daos?.map((dao: any) => (
                    <Button
                      key={dao.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setSelectedDao(dao.id)}
                      data-testid={`button-select-dao-${dao.id}`}
                    >
                      <span>{dao.name}</span>
                      <Badge variant={dao.plan === "premium" ? "default" : "secondary"} data-testid={`badge-plan-${dao.id}`}>
                        {dao.plan || "free"}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold" data-testid="text-current-plan">
                      {subscription?.plan === "premium" ? "Premium Plan" : "Free Plan"}
                    </h3>
                    <p className="text-sm text-gray-600" data-testid="text-plan-description">
                      {subscription?.plan === "premium" 
                        ? "All premium features enabled"
                        : "Upgrade to unlock premium features"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDao(null)} data-testid="button-change-dao">
                    Change DAO
                  </Button>
                </div>

                {subscription?.plan === "premium" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <Badge className="ml-2 bg-green-500" data-testid="badge-status">Active</Badge>
                      </div>
                      <div>
                        <span className="text-gray-600">Next billing:</span>
                        <span className="ml-2 font-medium" data-testid="text-next-billing">
                          {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">Premium Features</h4>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          Unlimited members & proposals
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          Multi-chain support
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          Advanced AI insights with Morio
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          Priority support
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            Upgrade to Premium
                          </h4>
                          <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                            Unlock unlimited members, multi-chain support, advanced AI insights, and more.
                          </p>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-2xl font-bold">KES 1,500</span>
                            <span className="text-sm text-gray-600">/month</span>
                          </div>
                          <Button
                            onClick={() => upgradeMutation.mutate(selectedDao)}
                            disabled={upgradeMutation.isPending}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600"
                            data-testid="button-upgrade-premium"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {upgradeMutation.isPending ? "Processing..." : "Upgrade Now"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing History */}
        {selectedDao && subscription?.plan === "premium" && (
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View your past payments and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Billing history will appear here once available.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
