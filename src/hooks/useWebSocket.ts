import { useEffect, useRef } from "react";
import { useTicketStore } from "../store/useTicketStore";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const {
    setWsConnected,
    setDbMode,
    addTicket,
    updateTicketInStore,
    addLog,
    incrementUnseen,
  } = useTicketStore();

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === "ticket_created") {
              addTicket(data.ticket);
              incrementUnseen();
            } else if (data.type === "ticket_updated") {
              updateTicketInStore(data.ticket);
              incrementUnseen();
            } else if (data.type === "notification_logged") {
              addLog(data.log);
            } else if (data.type === "system") {
              if (data.postgresActive !== undefined) {
                setDbMode(data.postgresActive ? "postgresql" : "local-json-memory");
              }
            }
          } catch (e) {
            console.error("Failed to interpret WS payload:", e);
          }
        };

        ws.onclose = () => {
          if (!active) return;
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWS, 4000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWS, 4000);
      }
    };

    connectWS();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimer);
    };
  }, [setWsConnected, setDbMode, addTicket, updateTicketInStore, addLog, incrementUnseen]);

  return wsRef;
}
