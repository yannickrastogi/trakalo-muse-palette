import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function Stems() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        <motion.div variants={item}>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Stems</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage audio stems for your tracks</p>
        </motion.div>

        <motion.div variants={item} className="card-premium flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
          <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-brand-orange" />
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Coming Soon</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-sm">
            Upload, organize, and manage individual stems — vocals, drums, bass, synths, and more.
          </p>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
