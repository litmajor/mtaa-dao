// components/VaultDisbursementAlert.tsx

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function VaultDisbursementAlert({ vaultId = "root-vault", showCommunityView = false }) {
  return (
    <Alert className="bg-yellow-50 border-yellow-300 text-yellow-900">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Vault Disbursement Alert</AlertTitle>
      <AlertDescription>
        Funds have recently been disbursed from <strong>{vaultId}</strong>.{" "}
        {showCommunityView && "You can review the vote and outcomes in the community proposal history."}
      </AlertDescription>
    </Alert>
  );
}
