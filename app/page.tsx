import { redirect } from 'next/navigation';

export default function Home() {
  // Langsung arahkan (redirect) pengunjung utama ke halaman Login
  redirect('/login');
}