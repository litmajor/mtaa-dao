/**
 * CREATE DAO PAGE - INTEGRATION WRAPPER
 * 
 * This file shows how to migrate the existing create-dao page to use
 * the new DAOOrchestratorSystem with stateful, narrative-driven UI.
 * 
 * MIGRATION STEPS:
 * 1. Wrap page in DAOOrchestratorProvider
 * 2. Replace current flow with NarrativeCreateDAO or hybrid approach
 * 3. Update existing components to use adaptive UI
 * 4. Connect form inputs to orchestrator metrics updates
 */

import React, { useState } from 'react';
import { DAOOrchestratorProvider } from '@/context/daoOrchestratorSystem';
import { NarrativeCreateDAO } from '@/components/dao-creation/NarrativeCreateDAO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * OPTION 1: Full Migration to Narrative Flow
 * 
 * This is the recommended approach for new implementations.
 * Completely replaces the form-based flow with the stateful narrative experience.
 */
export function CreateDAOPageNarrative() {
  return (
    <DAOOrchestratorProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-8">
        <NarrativeCreateDAO />
      </div>
    </DAOOrchestratorProvider>
  );
}

/**
 * OPTION 2: Hybrid Approach (Parallel Migration)
 * 
 * Keeps existing functionality while adding new stateful features.
 * Lets users choose between old and new flow.
 * Good for gradual migration.
 */
export function CreateDAOPageHybrid() {
  const [mode, setMode] = useState<'traditional' | 'narrative'>('narrative');

  return (
    <DAOOrchestratorProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* MODE SELECTOR */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Choose Your Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="traditional">Classic Form</TabsTrigger>
                  <TabsTrigger value="narrative">Stateful Journey (Beta)</TabsTrigger>
                </TabsList>

                <TabsContent value="traditional" className="mt-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Classic Form Experience</AlertTitle>
                    <AlertDescription>
                      Use the traditional form-based approach. (Original component goes here)
                    </AlertDescription>
                  </Alert>
                  {/* RENDER ORIGINAL CREATE DAO COMPONENT */}
                  <div className="mt-4 p-4 bg-slate-700 rounded text-slate-300">
                    Original CreateDAOFlow component would render here
                  </div>
                </TabsContent>

                <TabsContent value="narrative" className="mt-6">
                  <Alert className="bg-teal-900 border-teal-700">
                    <AlertCircle className="h-4 w-4 text-teal-400" />
                    <AlertTitle className="text-teal-100">Stateful Journey (Beta)</AlertTitle>
                    <AlertDescription className="text-teal-200">
                      Experience DAO creation as a narrative journey with real-time system feedback
                      and psychological progression.
                    </AlertDescription>
                  </Alert>
                  <div className="mt-4">
                    <NarrativeCreateDAO />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DAOOrchestratorProvider>
  );
}

/**
 * OPTION 3: Integration with Existing Components
 * 
 * If you want to keep using the existing CreateDAOFlow component
 * but add orchestrator features, you can wrap it and enhance it.
 */
export function CreateDAOPageEnhanced() {
  const [useNewSystem, setUseNewSystem] = useState(true);

  if (useNewSystem) {
    return <CreateDAOPageNarrative />;
  }

  // Fall back to original
  return <div>Original CreateDAOFlow component</div>;
}

// Export the recommended entry point
export default CreateDAOPageNarrative;

/**
 * MIGRATION GUIDE
 * ===============
 * 
 * 1. FOR EXISTING PAGES:
 *    Update create-dao.tsx to wrap with DAOOrchestratorProvider:
 * 
 *    ```typescript
 *    import { DAOOrchestratorProvider } from '@/context/daoOrchestratorSystem';
 *    
 *    export default function CreateDAOPage() {
 *      return (
 *        <DAOOrchestratorProvider>
 *          <YourExistingFlow />
 *        </DAOOrchestratorProvider>
 *      );
 *    }
 *    ```
 * 
 * 2. FOR EXISTING COMPONENTS:
 *    Add this to any component that should be stateful:
 * 
 *    ```typescript
 *    import { useDAOOrchestrator } from '@/context/daoOrchestratorSystem';
 *    
 *    export function YourComponent() {
 *      const orchestrator = useDAOOrchestrator();
 *      
 *      useEffect(() => {
 *        orchestrator.actions.updateGovernanceMetrics({
 *          decentralizationLevel: newValue,
 *        });
 *      }, [dependencies]);
 *      
 *      return (
 *        <div className={orchestrator.helpers.surfaceClass()}>
 *          {orchestrator.state.riskLevel === 'critical' && <CriticalWarning />}
 *        </div>
 *      );
 *    }
 *    ```
 * 
 * 3. FOR FORM VALIDATION:
 *    Use orchestrator state instead of local validation:
 * 
 *    ```typescript
 *    const canAdvance = orchestrator.state.overallReadiness > 50;
 *    ```
 * 
 * 4. FOR UI STYLING:
 *    Use adaptive surface classes:
 * 
 *    ```typescript
 *    <Card className={orchestrator.helpers.surfaceClass('moderate')} />
 *    ```
 * 
 * 5. FOR FEEDBACK LOOPS:
 *    Every form change should update metrics:
 * 
 *    ```typescript
 *    const handleMemberChange = (members) => {
 *      setMembers(members);
 *      orchestrator.actions.updateGovernanceMetrics({
 *        decentralizationLevel: members.length * 10,
 *      });
 *    };
 *    ```
 */
