import { useAuth, useAuth as useNewAuth } from '../providers/MockAuthProvider';

// Re-export specific fields to maintain compatibility with existing components
// while bridging to the new Context-based system.
export const useMockAuth = () => {
    const { user, hasPermission } = useNewAuth();
    return {
        user,
        hasPermission
    };
};
