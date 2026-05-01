import { useState, useRef, useEffect } from "react";
import { useAgentChat } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, TerminalSquare } from "lucide-react";
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
      content: "DST Agent Online. Ready for queries.",
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
  }, [messages]);

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
          content: "SYSTEM ERROR: Failed to process query. Check connection."
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
    <div className="max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <TerminalSquare className="w-6 h-6 text-primary" /> AGENT TERMINAL
        </h1>
        <p className="text-muted-foreground text-sm">Query the DST signal engine.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {PREBUILT_COMMANDS.map(cmd => (
          <Button 
            key={cmd} 
            variant="outline" 
            size="sm" 
            className="font-mono text-xs border-border bg-card hover:bg-accent"
            onClick={() => handleSend(cmd)}
            disabled={chatMutation.isPending}
          >
            &gt; {cmd}
          </Button>
        ))}
      </div>

      <Card className="flex-1 flex flex-col border-border bg-card overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-sm flex items-center justify-center shrink-0",
                  msg.role === "agent" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}>
                  {msg.role === "agent" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className={cn(
                  "space-y-2",
                  msg.role === "user" ? "text-right" : ""
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-sm inline-block text-sm",
                    msg.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-accent/50 text-foreground border border-border"
                  )}>
                    {msg.content}
                  </div>
                  
                  {msg.data && (
                    <div className="mt-2 text-left">
                      {msg.data.type === "signal" || msg.data.type === "audit" ? (
                        <div className="bg-background border border-border rounded-sm p-3 font-mono text-xs overflow-x-auto whitespace-pre">
                          {JSON.stringify(msg.data, null, 2)}
                        </div>
                      ) : (
                        <div className="bg-background border border-border rounded-sm p-3 font-mono text-xs overflow-x-auto whitespace-pre text-muted-foreground">
                          {JSON.stringify(msg.data, null, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 bg-primary text-primary-foreground">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="px-4 py-3 rounded-sm inline-block text-sm bg-accent/50 text-muted-foreground border border-border font-mono">
                  processing...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-background">
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command..." 
              className="font-mono bg-card border-border"
              disabled={chatMutation.isPending}
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || chatMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
            >
              <Send className="w-4 h-4 mr-2" />
              EXEC
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
