import Link from "next/link";
import { PieChart } from "lucide-react";
export function Brand() { return <Link href="/" className="flex items-center gap-2.5"><span className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200"><PieChart className="w-5 h-5 text-white" strokeWidth={2.5} aria-hidden="true" /></span><span className="text-xl font-bold tracking-tight text-gray-900">CGT<span className="text-blue-600">Tracker</span></span></Link>; }
