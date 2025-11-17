/**
 * Utility functions for exporting data to CSV format
 */

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  columns: { title: string; dataIndex: string | string[]; render?: (value: any, record: T) => any }[]
): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Create CSV header from column titles
  const headers = columns.map(col => `"${col.title}"`).join(',');

  // Create CSV rows
  const rows = data.map(record => {
    return columns.map(col => {
      let value: any;

      // Handle nested dataIndex (e.g., ['product', 'code'])
      if (Array.isArray(col.dataIndex)) {
        value = col.dataIndex.reduce((obj, key) => obj?.[key], record);
      } else {
        value = record[col.dataIndex];
      }

      // Apply render function if provided
      if (col.render && typeof col.render === 'function') {
        try {
          // Call render function and extract text content
          const rendered = col.render(value, record);

          // If render returns a React element, try to extract text
          if (rendered && typeof rendered === 'object' && rendered.props) {
            // Extract text from React element props
            if (rendered.props.children !== undefined) {
              const children = rendered.props.children;
              if (Array.isArray(children)) {
                value = children.map(c =>
                  typeof c === 'object' && c.props?.children ? c.props.children : c
                ).join(' ');
              } else {
                value = typeof children === 'object' && children.props?.children
                  ? children.props.children
                  : children;
              }
            }
          } else if (typeof rendered === 'string' || typeof rendered === 'number') {
            value = rendered;
          }
        } catch (e) {
          // If render fails, use original value
        }
      }

      // Convert value to string and escape quotes
      if (value === null || value === undefined) {
        return '""';
      }

      // Handle dates
      if (value instanceof Date) {
        value = value.toISOString();
      }

      // Convert to string and escape
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  }).join('\n');

  return `${headers}\n${rows}`;
}

/**
 * Trigger download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add BOM for Excel UTF-8 support
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Export table data to CSV
 */
export function exportTableToCSV<T extends Record<string, any>>(
  data: T[],
  columns: { title: string; dataIndex: string | string[]; render?: (value: any, record: T) => any }[],
  filename: string
): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const csv = convertToCSV(data, columns);

  // Add .csv extension if not present
  const csvFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  downloadCSV(csv, csvFilename);
}

/**
 * Format a filename with current timestamp
 */
export function getExportFilename(baseName: string): string {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and 'Z'
  return `${baseName}_${timestamp}.csv`;
}
