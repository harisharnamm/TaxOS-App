import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BookkeepingTransactionWithAccount } from './useBookkeepingTransactions';

export interface RealtimeEvent {
  id: string;
  event_type: string;
  transaction_id: string;
  payload: {
    data: BookkeepingTransactionWithAccount;
    timestamp: string;
    source: string;
  };
  created_at: string;
}

export function useRealtimeTransactions(
  clientId?: string,
  onTransactionUpdate?: (event: RealtimeEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Start real-time polling
  const startPolling = useCallback(async () => {
    if (isPollingRef.current) return;
    
    console.log('🚀 Starting real-time transaction polling...');
    isPollingRef.current = true;
    setIsConnected(true);

    const pollForEvents = async () => {
      try {
        // Get unprocessed events since last event
        let query = supabase
          .from('realtime_events')
          .select('*')
          .eq('processed', false)
          .order('created_at', { ascending: true });

        if (lastEventId) {
          query = query.gt('id', lastEventId);
        }

        const { data: events, error } = await query;

        if (error) {
          console.error('Error polling for real-time events:', error);
          return;
        }

        if (events && events.length > 0) {
          console.log(`📡 Received ${events.length} real-time events`);
          
          // Process each event
          for (const event of events) {
            // Filter events for this client if specified
            if (clientId) {
              const transactionData = event.payload.data;
              if (transactionData.client_id !== clientId) {
                continue;
              }
            }

            // Mark event as processed
            await supabase
              .from('realtime_events')
              .update({ processed: true })
              .eq('id', event.id);

            // Update last event ID
            setLastEventId(event.id);
            setEventCount(prev => prev + 1);

            // Call the update callback
            if (onTransactionUpdate) {
              onTransactionUpdate(event);
            }

            console.log(`✅ Processed real-time event: ${event.event_type} for transaction ${event.transaction_id}`);
          }
        }
      } catch (error) {
        console.error('Error in real-time polling:', error);
      }
    };

    // Initial poll
    await pollForEvents();

    // Set up polling interval (every 2 seconds for near real-time)
    pollingIntervalRef.current = setInterval(pollForEvents, 2000);

  }, [clientId, lastEventId, onTransactionUpdate]);

  // Stop real-time polling
  const stopPolling = useCallback(() => {
    console.log('🛑 Stopping real-time transaction polling...');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    isPollingRef.current = false;
    setIsConnected(false);
  }, []);

  // Manual refresh for immediate updates
  const refreshNow = useCallback(async () => {
    console.log('🔄 Manual refresh requested...');
    await startPolling();
  }, [startPolling]);

  // Start polling when hook mounts
  useEffect(() => {
    startPolling();

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Restart polling when clientId changes
  useEffect(() => {
    if (isConnected) {
      stopPolling();
      startPolling();
    }
  }, [clientId]);

  return {
    isConnected,
    eventCount,
    startPolling,
    stopPolling,
    refreshNow
  };
}
