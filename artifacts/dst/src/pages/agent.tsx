import { useState, useRef, useEffect } from "react";
import { useAgentChat } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  data?: any;
};

const PREBUILT_COMMANDS = [
  "help",
  "signal ETH",
  "signal BTC",
  "signal SOL",
  "audit ETH",
  "audit BTC",
  "watch ETH"
];

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: "DST // SIGNAL ENGINE ONLINE",
    }
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  
  const chatMutation = useAgentChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    chatMutation.mutate({
      data: {
        message: text.trim(),
        sessionId
      }
    }, {
      onSuccess: (response) => {
        if (!sessionId && response.sessionId) {
          setSessionId(response.sessionId);
        }

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: response.reply,
          data: response.data
        };

        setMessages(prev => [...prev, agentMessage]);
      },
      onError: () => {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: "SYSTEM_ERROR: FAILED_TO_PROCESS_QUERY"
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col pb-6 max-w-6xl mx-auto">
      <div className="pb-4 border-b border-border mb-6">
        <h1 className="text-2xl font-display text-foreground mb-1 uppercase">AGENT TERMINAL</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">NATURAL LANGUAGE INTERFACE TO THE DST SIGNAL ENGINE</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Command Shortcuts Sidebar */}
        <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
          <div className="text-[10px] font-mono text-muted-foreground uppercase mb-2">QUICK COMMANDS</div>
          {PREBUILT_COMMANDS.map(cmd => (
            <button 
              key={cmd} 
              className="text-left px-3 py-2 bg-transparent border border-border text-foreground font-mono text-xs hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              onClick={() => handleSend(cmd)}
              disabled={chatMutation.isPending}
            >
              &gt; {cmd}
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col border border-border bg-transparent min-w-0">
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="space-y-6">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === "user" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "px-4 py-3 text-sm font-mono whitespace-pre-wrap",
                    msg.role === "user" ? "bg-secondary border-r-2 border-primary text-foreground text-right" : "bg-card border-l-2 border-border text-body"
                  )}>
                    {msg.id === "welcome" ? <span className="text-primary">{msg.content}</span> : msg.content}
                  </div>
                  
                  {msg.data && (
                    <div className="mt-2 text-left w-full">
                      <div className="bg-background border border-border p-4 font-mono text-xs overflow-x-auto whitespace-pre text-muted-foreground">
                        {JSON.stringify(msg.data, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex flex-col items-start max-w-[85%]">
                  <div className="px-4 py-3 text-sm font-mono bg-card border-l-2 border-border text-body flex items-center gap-1">
                    PROCESSING<span className="animate-pulse text-primary font-bold">|</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-card">
            <form onSubmit={onSubmit} className="flex gap-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ENTER COMMAND..." 
                className="flex-1 px-4 py-2 font-mono text-sm bg-card border border-border text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                disabled={chatMutation.isPending}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || chatMutation.isPending}
                className="bg-primary text-sidebar font-mono text-sm font-bold px-8 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                EXEC
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
