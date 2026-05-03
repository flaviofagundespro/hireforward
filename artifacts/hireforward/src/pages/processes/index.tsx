import { Link, useLocation } from "wouter";
import { useListProcesses, useUpdateProcess, getListProcessesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, PauseCircle, PlayCircle, Users, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";

export default function Processes() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: processes, isLoading } = useListProcesses();
  const updateProcess = useUpdateProcess();
  
  const [search, setSearch] = useState("");

  const filteredProcesses = processes?.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.area.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    updateProcess.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">Active</Badge>;
      case 'paused': return <Badge variant="secondary" className="text-yellow-700 bg-yellow-500/10 border-yellow-200">Paused</Badge>;
      case 'draft': return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-slate-100 text-slate-500">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Job Processes</h1>
          <p className="text-muted-foreground mt-1">Manage your active and past hiring workflows.</p>
        </div>
        <Link href="/processes/new">
          <Button className="bg-primary">
            <Plus className="mr-2 h-4 w-4" /> New Process
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search processes..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-2/3 mb-4" />
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProcesses.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <h3 className="text-lg font-medium">No processes found</h3>
          <p className="text-muted-foreground mt-2 mb-4">You don't have any processes that match your search.</p>
          <Link href="/processes/new">
            <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Create New Process</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProcesses.map(process => (
            <Card key={process.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1 pr-4">
                  <CardTitle className="text-lg leading-tight line-clamp-2">
                    <Link href={`/processes/${process.id}`} className="hover:underline">
                      {process.title}
                    </Link>
                  </CardTitle>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <span>{process.area}</span>
                    <span>•</span>
                    <span>{process.seniority}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLocation(`/processes/${process.id}`)}>
                      <Settings className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation(`/processes/${process.id}/candidates`)}>
                      <Users className="mr-2 h-4 w-4" /> Manage Candidates
                    </DropdownMenuItem>
                    {process.status === 'active' || process.status === 'paused' ? (
                      <DropdownMenuItem onClick={() => handleToggleStatus(process.id, process.status)}>
                        {process.status === 'active' ? (
                          <><PauseCircle className="mr-2 h-4 w-4" /> Pause Process</>
                        ) : (
                          <><PlayCircle className="mr-2 h-4 w-4" /> Resume Process</>
                        )}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  {getStatusBadge(process.status)}
                  <span className="text-xs text-muted-foreground font-medium">
                    {format(new Date(process.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Candidates</div>
                    <div className="text-lg font-semibold">{process.candidatesTotal}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Evaluated</div>
                    <div className="text-lg font-semibold">{process.candidatesEvaluated}</div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4">
                  <Button variant="secondary" className="w-full bg-primary/5 hover:bg-primary/10 text-primary border-primary/20" onClick={() => setLocation(`/processes/${process.id}/candidates`)}>
                    View Candidates
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}