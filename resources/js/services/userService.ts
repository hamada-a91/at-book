import axios from '../lib/axios';

export interface User {
    id: number;
    name: string;
    email: string;
    roles: Array<{ name: string }>;
    created_at: string;
}

export interface Role {
    name: string;
    permissions: string[];
}

export const userService = {
    getUsers: async () => {
        const response = await axios.get<User[]>('/api/users');
        return response.data;
    },

    getRoles: async () => {
        const response = await axios.get<Role[]>('/api/roles');
        return response.data;
    },

    createUser: async (data: any) => {
        const response = await axios.post<User>('/api/users', data);
        return response.data;
    },

    updateUser: async (id: number, data: any) => {
        const response = await axios.put<User>(`/api/users/${id}`, data);
        return response.data;
    },

    deleteUser: async (id: number) => {
        await axios.delete(`/api/users/${id}`);
    }
};
