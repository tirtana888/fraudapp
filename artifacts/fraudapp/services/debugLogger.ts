/**
 * Debug Logger Utility
 * Provides enhanced logging when debug mode is enabled
 */

import { getSystemSettings } from './systemConfigService';

class DebugLogger {
    private isDebugMode: boolean = false;
    private lastCheck: number = 0;
    private checkInterval: number = 60000; // Check every 60 seconds

    constructor() {
        this.checkDebugMode();
    }

    private async checkDebugMode() {
        try {
            const now = Date.now();

            // Only check if enough time has passed
            if (now - this.lastCheck < this.checkInterval) {
                return;
            }

            const settings = await getSystemSettings();
            this.isDebugMode = settings.debugMode;
            this.lastCheck = now;

            if (this.isDebugMode) {
                console.log('%c[DEBUG MODE] Enabled', 'color: #FF8C00; font-weight: bold');
            }
        } catch (error) {
            // Silently fail - don't break app if can't check debug mode
            this.isDebugMode = false;
        }
    }

    /**
     * Log general debug information
     */
    async log(message: string, ...args: any[]) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.log(`%c[DEBUG] ${message}`, 'color: #4A90E2', ...args);
        }
    }

    /**
     * Log API calls
     */
    async api(method: string, endpoint: string, data?: any) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.group(`%c[DEBUG API] ${method} ${endpoint}`, 'color: #50C878; font-weight: bold');
            console.log('Timestamp:', new Date().toISOString());
            if (data) {
                console.log('Data:', data);
            }
            console.groupEnd();
        }
    }

    /**
     * Log errors with full details
     */
    async error(message: string, error: any, context?: any) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.group(`%c[DEBUG ERROR] ${message}`, 'color: #E74C3C; font-weight: bold');
            console.error('Error:', error);
            console.error('Message:', error?.message);
            console.error('Stack:', error?.stack);
            if (context) {
                console.error('Context:', context);
            }
            console.error('Timestamp:', new Date().toISOString());
            console.groupEnd();
        } else {
            // Always log errors, but simplified
            console.error(message, error?.message || error);
        }
    }

    /**
     * Log performance metrics
     */
    async performance(label: string, duration: number) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            const color = duration > 1000 ? '#E74C3C' : duration > 500 ? '#F39C12' : '#50C878';
            console.log(`%c[DEBUG PERF] ${label}: ${duration}ms`, `color: ${color}; font-weight: bold`);
        }
    }

    /**
     * Log database operations
     */
    async database(operation: string, collection: string, data?: any) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.group(`%c[DEBUG DB] ${operation} - ${collection}`, 'color: #9B59B6; font-weight: bold');
            console.log('Timestamp:', new Date().toISOString());
            if (data) {
                console.log('Data:', data);
            }
            console.groupEnd();
        }
    }

    /**
     * Log authentication events
     */
    async auth(event: string, userId?: string) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.log(`%c[DEBUG AUTH] ${event}`, 'color: #E67E22; font-weight: bold', userId ? `User: ${userId}` : '');
        }
    }

    /**
     * Log state changes
     */
    async state(component: string, oldState: any, newState: any) {
        await this.checkDebugMode();
        if (this.isDebugMode) {
            console.group(`%c[DEBUG STATE] ${component}`, 'color: #3498DB; font-weight: bold');
            console.log('Old State:', oldState);
            console.log('New State:', newState);
            console.log('Changes:', this.getChanges(oldState, newState));
            console.groupEnd();
        }
    }

    /**
     * Helper to detect changes between states
     */
    private getChanges(oldState: any, newState: any): any {
        const changes: any = {};

        if (typeof oldState !== 'object' || typeof newState !== 'object') {
            return { old: oldState, new: newState };
        }

        for (const key in newState) {
            if (oldState[key] !== newState[key]) {
                changes[key] = {
                    old: oldState[key],
                    new: newState[key]
                };
            }
        }

        return changes;
    }

    /**
     * Measure execution time
     */
    async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            await this.performance(label, duration);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            await this.error(`${label} failed after ${duration}ms`, error);
            throw error;
        }
    }

    /**
     * Check if debug mode is currently enabled
     */
    async isEnabled(): Promise<boolean> {
        await this.checkDebugMode();
        return this.isDebugMode;
    }
}

// Export singleton instance
export const debugLogger = new DebugLogger();

// Export convenience functions
export const debugLog = (message: string, ...args: any[]) => debugLogger.log(message, ...args);
export const debugApi = (method: string, endpoint: string, data?: any) => debugLogger.api(method, endpoint, data);
export const debugError = (message: string, error: any, context?: any) => debugLogger.error(message, error, context);
export const debugPerf = (label: string, duration: number) => debugLogger.performance(label, duration);
export const debugDb = (operation: string, collection: string, data?: any) => debugLogger.database(operation, collection, data);
export const debugAuth = (event: string, userId?: string) => debugLogger.auth(event, userId);
export const debugState = (component: string, oldState: any, newState: any) => debugLogger.state(component, oldState, newState);
export const debugMeasure = <T>(label: string, fn: () => Promise<T>) => debugLogger.measure(label, fn);
