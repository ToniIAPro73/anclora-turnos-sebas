          content: "You are a work shift schedule parser. Extract shifts from OCR text and return valid JSON.",
        } as const,
        {
          role: "user",
          content: prompt,
        } as const,
      ],
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "shifts_extraction",
          strict: true,
          schema: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                day: { type: "number" as const, description: "Day of month" },
                month: { type: "number" as const, description: "Month" },
                year: { type: "number" as const, description: "Year" },
                shiftType: { type: "string" as const, description: "Type of shift" },
                startTime: { type: ["string", "null"] as const, description: "Start time HH:MM or null" },
                endTime: { type: ["string", "null"] as const, description: "End time HH:MM or null" },
                color: { type: "string" as const, description: "Color code" },
                notes: { type: "string" as const, description: "Notes" },
              },
              required: ["day", "month", "year", "shiftType", "color"],
            } as const,
          } as const,
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {