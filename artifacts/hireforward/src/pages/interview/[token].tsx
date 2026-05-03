import { useState, useRef, useEffect, useCallback } from "react";
import { useGetInterviewByToken, useStartInterview, useEndInterview, getGetInterviewByTokenQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, Loader2, Info, Clock, Timer, AlertTriangle } from "lucide-react";

export default function Interview({ params }: { params: { token: string } }) {
  const token = params.token;
  const queryClient = useQueryClient();
  
  const { data: info, isLoading: isLoadingInfo } = useGetInterviewByToken(token);
  const startInterview = useStartInterview();
  const endInterview = useEndInterview();

  const [session, setSession] = useState<{ sessionId: string, startedAt: string } | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef(false);

  const timeLimitSeconds = info?.responseTimeLimitSeconds ?? null;
  const timerEnabled = !!session && !!timeLimitSeconds && timeLimitSeconds > 0;

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Determine urgency color
  const timerColor = timeLeft !== null
    ? timeLeft <= 10
      ? "text-red-600"
      : timeLeft <= 30
        ? "text-orange-500"
        : "text-emerald-600"
    : "text-emerald-600";

  const timerBg = timeLeft !== null
    ? timeLeft <= 10
      ? "bg-red-50 border-red-200"
      : timeLeft <= 30
        ? "bg-orange-50 border-orange-200"
        : "bg-emerald-50 border-emerald-200"
    : "bg-emerald-50 border-emerald-200";

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
  }, []);

  const startTimer = useCallback((seconds: number) => {
    stopTimer();
    setTimeLeft(seconds);
    setTimerActive(true);
    autoSubmitRef.current = false;
  }, [stopTimer]);

  // Tick the timer
  useEffect(() => {
    if (!timerActive || timeLeft === null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, stopTimer]);

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (timeLeft === 0 && !autoSubmitRef.current && !isStreaming && timerEnabled) {
      autoSubmitRef.current = true;
      const draft = inputValue.trim();
      if (draft) {
        handleSendMessage();
      } else {
        // Send a placeholder so the interview keeps moving
        setInputValue("(Time expired — no response provided)");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleStart = () => {
    if (!info) return;
    startInterview.mutate(
      { token, data: { candidateName: info.candidateName } },
      {
        onSuccess: (data) => {
          setSession(data);
          setMessages([{ role: "assistant", content: `Hello ${info.candidateName}, welcome to your interview for the ${info.processTitle} role at ${info.companyName}. I am an AI agent and I'll be conducting this interview today. Whenever you're ready, let me know and we can begin.` }]);
          // Start timer for first response if enabled
          if (timeLimitSeconds && timeLimitSeconds > 0) {
            startTimer(timeLimitSeconds);
          }
        }
      }
    );
  };

  const handleSendMessage = async (overrideInput?: string) => {
    const msg = overrideInput ?? inputValue;
    if (!msg.trim() || !session || isStreaming) return;

    // Stop timer while AI responds
    stopTimer();
    setTimeLeft(null);

    const userMessage = msg;
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/interview/${token}/message`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: userMessage, sessionId: session.sessionId })
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
    } finally {
      setIsStreaming(false);
      // Restart timer after AI replies
      if (timerEnabled && timeLimitSeconds) {
        startTimer(timeLimitSeconds);
      }
    }
  };

  const handleEnd = () => {
    if (!session) return;
    stopTimer();
    endInterview.mutate(
      { token },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetInterviewByTokenQueryKey(token) });
          setSession(null);
        }
      }
    );
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoadingInfo) {
    return <div className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!info) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">Invalid or expired link.</div>;
  }

  if (info.status === 'completed') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Interview Completed</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for completing the interview for {info.companyName}. Your responses have been recorded and are being evaluated.
          </p>
          <p className="text-sm text-muted-foreground">You may close this window.</p>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto w-full mt-12 space-y-8">
          <div className="text-center space-y-4">
            {info.companyLogoUrl && <img src={info.companyLogoUrl} alt={info.companyName} className="h-12 mx-auto" />}
            <h1 className="text-3xl font-bold text-foreground">Welcome, {info.candidateName}</h1>
            <p className="text-xl text-muted-foreground">Interview for {info.processTitle} at {info.companyName}</p>
          </div>

          <Card className="border-primary/20 shadow-md">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Estimated Time</h3>
                  <p className="text-muted-foreground">{info.estimatedMinutes} minutes</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Instructions</h3>
                  <p className="text-muted-foreground">
                    This is an AI-conducted interview. Read the questions carefully and take your time to respond.
                    {info.toolsAllowed ? " You may use any tool during this interview (IDEs, Google, etc.)." : " Please do not use external tools during this interview."}
                  </p>
                </div>
              </div>

              {timeLimitSeconds && timeLimitSeconds > 0 && (
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-3 rounded-full text-orange-600 shrink-0">
                    <Timer className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Response Time Limit</h3>
                    <p className="text-muted-foreground">
                      You have <span className="font-semibold text-orange-600">{formatTime(timeLimitSeconds)}</span> to submit each response.
                      When the timer reaches zero, your current answer will be submitted automatically.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button 
            size="lg" 
            className="w-full h-14 text-lg bg-primary hover:bg-primary/90" 
            onClick={handleStart}
            disabled={startInterview.isPending}
          >
            {startInterview.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Start Interview
          </Button>
        </div>
      </div>
    );
  }

  // Active Interview UI
  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50">
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="font-semibold text-foreground hidden sm:block">{info.companyName} - {info.processTitle}</div>
        <div className="font-semibold text-foreground sm:hidden">Interview</div>

        <div className="flex items-center gap-3">
          {/* Countdown timer display */}
          {timerEnabled && timeLeft !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold transition-colors ${timerBg} ${timerColor}`}>
              {timeLeft <= 10 ? (
                <AlertTriangle className="h-4 w-4 animate-pulse" />
              ) : (
                <Timer className="h-4 w-4" />
              )}
              {formatTime(timeLeft)}
            </div>
          )}
          <Button variant="destructive" size="sm" onClick={handleEnd}>End Interview</Button>
        </div>
      </header>

      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 w-full max-w-3xl mx-auto"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-br-sm' 
                  : 'bg-white border text-foreground rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 font-medium mb-2 text-primary text-sm">
                  <Bot className="h-4 w-4" />
                  Interviewer
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.content}</div>
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1].role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Typing...</span>
            </div>
          </div>
        )}
        <div className="h-4" /> {/* Bottom padding */}
      </main>

      <footer className="bg-white border-t shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        {/* Timer progress bar */}
        {timerEnabled && timeLeft !== null && timeLimitSeconds && (
          <div className="w-full h-1 bg-gray-100">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-orange-400" : "bg-emerald-500"
              }`}
              style={{ width: `${(timeLeft / timeLimitSeconds) * 100}%` }}
            />
          </div>
        )}
        <div className="p-3 sm:p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea 
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                adjustTextareaHeight(e);
              }}
              onKeyDown={handleKeyDown}
              placeholder={timerEnabled && timeLeft !== null ? `Type your response... (${formatTime(timeLeft)} remaining)` : "Type your response here... (Shift+Enter for new line)"}
              className="min-h-[48px] max-h-[150px] resize-none bg-muted/20 border-border focus-visible:ring-primary rounded-xl py-3 px-4"
              disabled={isStreaming}
              rows={1}
            />
            <Button 
              size="icon" 
              className="h-12 w-12 rounded-xl shrink-0 bg-primary hover:bg-primary/90"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isStreaming}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
