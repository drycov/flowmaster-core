import { Input } from "@/components/ui/input";
import { Search, X, Filter } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "../domain/roles";

export function UserFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  roles,
  t,
}: any) {
  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-2.5 w-4 h-4" />

        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />

        {searchTerm && (
          <button onClick={() => onSearchChange("")}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger>
          <Filter className="w-4 h-4" />
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {roles.map((r: Role) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}