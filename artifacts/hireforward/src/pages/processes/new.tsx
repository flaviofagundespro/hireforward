import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateProcess, useFinalizeProcessConfig, getGetProcessQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Bot, Send, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/react";

const IMP_SESSION_KEY = "hf_imp";
function getImpersonationToken(): string | null {
  try {
    const raw = sessionStorage.getItem(IMP_SESSION_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token: string }).token;
  } catch { return null; }
}

export default function NewProcess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const createProcess = useCreateProcess();
  const finalizeConfig = useFinalizeProcessConfig();

  const [step, setStep] = useState(1);
  const [processId, setProcessId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [seniority, setSeniority] = useState("");
  const [interviewType, setInterviewType] = useState<"technical" | "behavioral" | "hybrid">("technical");
  const [toolsAllowed, setToolsAllowed] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! I'm the HireForward AI Configurator. Based on the role details, what specific skills or experiences are most critical for this position? We can also discuss any specific behavioral traits you are looking for." }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleCreateBasic = () => {
    if (!title || !area || !seniority) return;

    createProcess.mutate(
      { 
        data: { title, area, seniority, interviewType, toolsAllowed } 
      },
      {
        onSuccess: (data) => {
          setProcessId(data.id);
          setStep(2);
        }
      }
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !processId || isStreaming) return;

    const userMessage = inputValue;
    setInputValue("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const authToken = getImpersonationToken() ?? await getToken();
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/processes/${processId}/configure`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${authToken}` 
        },
        body: JSON.stringify({ content: userMessage })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  lastMessage.content += data.content;
                  return newMessages;
                });
              }
              if (data.done) {
                setIsStreaming(false);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsStreaming(false);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleFinalize = () => {
    if (!processId) return;
    
    finalizeConfig.mutate(
      { id: processId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(processId) });
          setLocation(`/processes/${processId}`);
        }
      }
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/processes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create New Process</h1>
          <p className="text-sm text-muted-foreground">Configure a new AI-conducted interview process.</p>
        </div>
      </div>

      {step === 1 ? (
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Provide the high-level details for this role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Job Title</Label>
                <Input id="title" placeholder="e.g. Senior Frontend Engineer" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="area">Department/Area</Label>
                  <Input id="area" placeholder="e.g. Engineering" value={area} onChange={e => setArea(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="seniority">Seniority Level</Label>
                  <Select value={seniority} onValueChange={setSeniority}>
                    <SelectTrigger id="seniority"><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Junior">Junior</SelectItem>
                      <SelectItem value="Mid-Level">Mid-Level</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Principal">Principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="interviewType">Interview Type</Label>
                <Select value={interviewType} onValueChange={(v: any) => setInterviewType(v)}>
                  <SelectTrigger id="interviewType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical Focus</SelectItem>
                    <SelectItem value="behavioral">Behavioral Focus</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Tech + Behavioral)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-base">Allow External Tools</Label>
                  <p className="text-sm text-muted-foreground">Candidates can use IDEs, Google, or other tools during the interview.</p>
                </div>
                <Switch checked={toolsAllowed} onCheckedChange={setToolsAllowed} />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                size="lg" 
                className="w-full sm:w-auto" 
                onClick={handleCreateBasic} 
                disabled={!title || !area || !seniority || createProcess.isPending}
              >
                {createProcess.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next: AI Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 shadow-md">
          <CardHeader className="shrink-0 border-b bg-muted/10 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Process Configurator
                </CardTitle>
                <CardDescription className="mt-1">
                  Chat with the agent to refine evaluation criteria and interview style.
                </CardDescription>
              </div>
              <Button 
                onClick={handleFinalize} 
                disabled={isStreaming || finalizeConfig.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {finalizeConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Approve & Activate Process
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
            >
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                        : 'bg-white border shadow-sm text-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 font-medium mb-1 text-primary text-xs">
                        <Bot className="h-3 w-3" />
                        HireForward AI
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1].role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white border shadow-sm rounded-2xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-white border-t shrink-0">
              <form 
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <Input 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Type your requirements..." 
                  disabled={isStreaming}
                  className="flex-1 bg-muted/20"
                  autoFocus
                />
                <Button type="submit" disabled={!inputValue.trim() || isStreaming} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}