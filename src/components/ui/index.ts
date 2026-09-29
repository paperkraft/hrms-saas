/**
 * UI Components - Professional & Premium
 * 
 * This file exports all UI components for easy importing throughout the application.
 * All components follow the professional UI/UX design system.
 */

// Core Components
export { Button, buttonVariants } from "./button";
export { Input } from "./input";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";
export { Label } from "./label";
export { Badge, badgeVariants } from "./badge";
export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from "./table";

// Form Components
export {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    useFormField,
} from "./form";

// Loading States
export { Skeleton } from "./skeleton";

// Data Display
export { StatCard } from "./data-display";

// Layout & Pages
export { PageContainer } from "@/components/layout/page-layout";

// Navigation
export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbEllipsis,
} from "./breadcrumb";

// Dialogs & Overlays
export { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "./alert-dialog";
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "./dialog";
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./sheet";

// Dropdowns & Menus
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup } from "./dropdown-menu";

// Tabs & Accordions
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";

// Other Components
export { Progress } from "./progress";
export { Checkbox } from "./checkbox";
// export { RadioGroup, RadioGroupItem } from "./radio-group";
export { Switch } from "./switch";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton } from "./select";
export { Textarea } from "./textarea";
export { Toggle, toggleVariants } from "./toggle";
export { ToggleGroup } from "./toggle-group";
export { Popover, PopoverTrigger, PopoverContent } from "./popover";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { Calendar } from "./calendar";
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";
export { Separator } from "./separator";
// export { Alert, AlertTitle, AlertDescription } from "./alert";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./collapsible";
export { Sonner } from "./sonner";
export { Spinner } from "./spinner";
export { Slider } from "./slider";

/**
 * CSS Utilities for Professional Styling
 * 
 * Import these utility classes in your components for consistent styling:
 * 
 * Animations:
 * - animate-fade-in: Fade in animation
 * - animate-fade-in-up: Fade in with upward movement
 * - animate-fade-in-down: Fade in with downward movement
 * - animate-scale-in: Scale in animation
 * - animate-slide-in-right: Slide in from right
 * - animate-pulse-soft: Gentle pulsing
 * - animate-bounce-soft: Soft bounce
 * - animate-shimmer: Shimmer loading effect
 * 
 * Cards:
 * - premium-card: Professional card styling
 * - premium-card-elevated: Elevated card styling
 * 
 * Effects:
 * - glass: Glassmorphism effect
 * - glass-dark: Dark glassmorphism effect
 * - text-gradient: Gradient text effect
 * 
 * Interactions:
 * - focus-ring: Professional focus ring
 * - focus-ring-inset: Inset focus ring
 * - hover-lift: Hover elevation
 * - hover-glow: Hover glow effect
 * - disabled-opacity: Disabled state styling
 * 
 * Transitions:
 * - transition-smooth: Smooth transitions
 * - transition-bounce: Bouncy transitions
 * 
 * Badges:
 * - badge-sm: Small badge
 * - badge-md: Medium badge
 */
