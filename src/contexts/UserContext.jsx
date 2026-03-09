
import { createContext, useContext, useState, useEffect } from 'react';

import { api } from '../lib/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const response = await api.fetch('/users');
            const data = await response.json();
            setUsers(data);
            // Default to first user (Employee)
            // if (data.length > 1) {
            //     setUser(data[1]); 
            // } else if (data.length > 0) {
            //     setUser(data[0]);
            // }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const login = (userId) => {
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) {
            setUser(selectedUser);
        }
    };

    return (
        <UserContext.Provider value={{ user, users, login, loading }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
