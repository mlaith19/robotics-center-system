"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const ISRAELI_CITIES = [
  // ערים גדולות
  "ירושלים",
  "תל אביב-יפו",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "אשקלון",
  "רחובות",
  "בת ים",
  "בית שמש",
  "כפר סבא",
  "הרצליה",
  "חדרה",
  "מודיעין-מכבים-רעות",
  "לוד",
  "רעננה",
  "רמלה",
  "גבעתיים",
  "נהריה",
  "יבנה",
  "הוד השרון",
  "אור יהודה",
  "קריית גת",
  "עפולה",
  "קריית מוצקין",
  "נס ציונה",
  "אילת",
  "טבריה",
  "רהט",
  "רמת השרון",
  "כרמיאל",
  "אור עקיבא",
  "בית שאן",
  "מגדל העמק",
  "דימונה",
  "עכו",
  "צפת",
  "קריית שמונה",
  "קריית ביאליק",
  "קריית ים",
  "קריית אתא",
  "נתיבות",
  "אופקים",
  "ערד",
  "יהוד-מונוסון",
  "גבעת שמואל",
  "מעלה אדומים",
  "ביתר עילית",
  "מודיעין עילית",
  "אלעד",
  // ערים וכפרים ערביים ודרוזיים
  "נצרת",
  "נצרת עילית (נוף הגליל)",
  "אום אל-פחם",
  "שפרעם",
  "טמרה",
  "סחנין",
  "טירה",
  "קלנסווה",
  "באקה אל-גרביה",
  "יפיע",
  "כפר קאסם",
  "טייבה",
  "ריינה",
  "עילוט",
  "כפר כנא",
  "דבוריה",
  "עין מאהל",
  "משהד",
  "אכסאל",
  "כפר מנדא",
  "סולם",
  "נין",
  "דאלית אל-כרמל",
  "עוספיה",
  "יאנוח-ג'ת",
  "פקיעין",
  "מג'ד אל-כרום",
  "עראבה",
  "דיר חנא",
  "כאבול",
  "בועיינה-נוג'ידאת",
  "טורען",
  "ג'דיידה-מכר",
  "כפר יאסיף",
  "ג'ולס",
  "ירכא",
  "אבו סנאן",
  "חורפיש",
  "בית ג'ן",
  "ראמה",
  "כסרא-סמיע",
  // מועצות אזוריות וישובים
  "זכרון יעקב",
  "פרדס חנה-כרכור",
  "בנימינה-גבעת עדה",
  "קיסריה",
  "עתלית",
  "טירת כרמל",
  "יוקנעם עילית",
  "מגדל",
  "כנרת",
  "עין גב",
]

interface CityComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function CityCombobox({ value, onChange, placeholder = "בחר עיר...", className }: CityComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Filter cities based on search query
  const filteredCities = ISRAELI_CITIES.filter((city) =>
    city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if current search query is not in the list (for custom entry)
  const canAddCustomCity = searchQuery.trim() !== "" && 
    !ISRAELI_CITIES.some(city => city.toLowerCase() === searchQuery.toLowerCase())

  const handleSelectCustomCity = () => {
    onChange(searchQuery.trim())
    setOpen(false)
    setSearchQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-12", className)}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="חפש או הקלד עיר..." 
            className="h-9" 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {filteredCities.length === 0 && !canAddCustomCity && (
              <CommandEmpty>לא נמצאה עיר</CommandEmpty>
            )}
            {canAddCustomCity && (
              <CommandGroup heading="הוסף עיר חדשה">
                <CommandItem
                  value={`add-${searchQuery}`}
                  onSelect={handleSelectCustomCity}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  הוסף: "{searchQuery}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={canAddCustomCity ? "ערים קיימות" : undefined}>
              {filteredCities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                    setSearchQuery("")
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === city ? "opacity-100" : "opacity-0")} />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
