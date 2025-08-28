"""
Selector Strategy Module

Generates robust selectors with multiple fallback strategies:
- Role/ARIA attributes (preferred)
- Data attributes (data-testid, data-cy, etc.)
- Semantic HTML selectors
- CSS selectors (fallback)
- XPath selectors (last resort)
"""

import re
from typing import List, Dict, Any, Optional
from enum import Enum


class SelectorStrategy(Enum):
    ROLE_ARIA = "role_aria"
    DATA_TESTID = "data_testid"
    SEMANTIC = "semantic"
    CSS_FALLBACK = "css_fallback"
    XPATH_FALLBACK = "xpath_fallback"


class SelectorGenerator:
    def __init__(self):
        self.strategies = {
            SelectorStrategy.ROLE_ARIA: self._role_aria_strategy,
            SelectorStrategy.DATA_TESTID: self._data_testid_strategy,
            SelectorStrategy.SEMANTIC: self._semantic_strategy,
            SelectorStrategy.CSS_FALLBACK: self._css_fallback_strategy,
            SelectorStrategy.XPATH_FALLBACK: self._xpath_fallback_strategy,
        }

    def generate_selectors(
        self,
        element_info: Dict[str, Any],
        strategies: List[SelectorStrategy] = None
    ) -> Dict[str, str]:
        """
        Generate selectors using specified strategies

        Args:
            element_info: Dictionary containing element information
            strategies: List of strategies to use (default: all strategies)

        Returns:
            Dictionary with strategy names as keys and selector strings as values
        """
        if strategies is None:
            strategies = list(SelectorStrategy)

        selectors = {}
        for strategy in strategies:
            if strategy in self.strategies:
                selector = self.strategies[strategy](element_info)
                if selector:
                    selectors[strategy.value] = selector

        return selectors

    def generate_robust_selector(
        self,
        element_info: Dict[str, Any],
        strategies: List[SelectorStrategy] = None
    ) -> str:
        """
        Generate a single robust selector with fallbacks

        Args:
            element_info: Dictionary containing element information
            strategies: List of strategies to use in order of preference

        Returns:
            Playwright locator string with chained fallbacks
        """
        if strategies is None:
            strategies = [
                SelectorStrategy.ROLE_ARIA,
                SelectorStrategy.DATA_TESTID,
                SelectorStrategy.SEMANTIC,
                SelectorStrategy.CSS_FALLBACK,
                SelectorStrategy.XPATH_FALLBACK,
            ]

        selectors = []
        for strategy in strategies:
            if strategy in self.strategies:
                selector = self.strategies[strategy](element_info)
                if selector:
                    selectors.append(selector)

        if not selectors:
            return 'page.locator("*")'  # Fallback to any element

        # Return chained locator with fallbacks
        return ' >> '.join(f'page.locator("{sel}")' for sel in selectors)

    def _role_aria_strategy(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Generate selector using role and ARIA attributes"""
        element_type = element_info.get('type', '').lower()
        label = element_info.get('label', '')
        aria_label = element_info.get('aria-label', '')
        role = element_info.get('role', '')

        selectors = []

        # Role-based selector
        if role:
            selectors.append(f'[role="{role}"]')
        elif element_type in ['button', 'link', 'textbox', 'checkbox']:
            selectors.append(f'[role="{element_type}"]')

        # ARIA label selectors
        if aria_label:
            selectors.append(f'[aria-label="{aria_label}"]')
            selectors.append(f'[aria-label*="{aria_label}"]')

        if label and label != aria_label:
            selectors.append(f'[aria-label*="{label}"]')

        # ARIA labelledby
        if element_info.get('aria-labelledby'):
            selectors.append(f'[aria-labelledby*="{element_info["aria-labelledby"]}"]')

        return ' >> '.join(selectors) if selectors else None

    def _data_testid_strategy(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Generate selector using data attributes"""
        data_attrs = element_info.get('data', {})

        selectors = []

        # Common test attributes
        test_attrs = ['data-testid', 'data-cy', 'data-test', 'data-e2e', 'data-qa']
        for attr in test_attrs:
            if attr in data_attrs:
                selectors.append(f'[{attr}="{data_attrs[attr]}"]')

        # Generic data attributes that might be useful for testing
        for key, value in data_attrs.items():
            if key.startswith('data-') and any(term in key for term in ['id', 'name', 'key']):
                selectors.append(f'[{key}="{value}"]')

        return ' >> '.join(selectors) if selectors else None

    def _semantic_strategy(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Generate selector using semantic HTML and attributes"""
        element_type = element_info.get('type', '').lower()
        name = element_info.get('name', '')
        id_attr = element_info.get('id', '')
        placeholder = element_info.get('placeholder', '')
        text = element_info.get('text', '')
        class_name = element_info.get('class', '')

        selectors = []

        # ID attribute (most specific)
        if id_attr:
            selectors.append(f'#{id_attr}')
            selectors.append(f'[{element_type}][id="{id_attr}"]')

        # Name attribute (common for form elements)
        if name:
            selectors.append(f'[{element_type}][name="{name}"]')

        # Placeholder text
        if placeholder:
            selectors.append(f'[{element_type}][placeholder="{placeholder}"]')
            selectors.append(f'[{element_type}][placeholder*="{placeholder}"]')

        # Text content (for buttons, links, etc.)
        if text:
            if element_type == 'button':
                selectors.append(f'button:has-text("{text}")')
                selectors.append(f'[role="button"]:has-text("{text}")')
            elif element_type == 'a':
                selectors.append(f'a:has-text("{text}")')
            else:
                selectors.append(f'{element_type}:has-text("{text}")')

        # Class-based selectors (less reliable, but sometimes necessary)
        if class_name and not self._is_dynamic_class(class_name):
            class_selectors = class_name.split()
            if class_selectors:
                selectors.append(f'{element_type}.{class_selectors[0]}')

        return ' >> '.join(selectors) if selectors else None

    def _css_fallback_strategy(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Generate CSS selector as fallback"""
        element_type = element_info.get('type', '').lower()
        name = element_info.get('name', '')
        id_attr = element_info.get('id', '')
        class_name = element_info.get('class', '')

        selectors = []

        # Basic element type
        selectors.append(element_type)

        # With name
        if name:
            selectors.append(f'{element_type}[name="{name}"]')

        # With ID
        if id_attr:
            selectors.append(f'{element_type}#{id_attr}')

        # With class
        if class_name and not self._is_dynamic_class(class_name):
            first_class = class_name.split()[0]
            selectors.append(f'{element_type}.{first_class}')

        return ' >> '.join(selectors) if selectors else element_type

    def _xpath_fallback_strategy(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Generate XPath selector as last resort"""
        element_type = element_info.get('type', '').lower()
        name = element_info.get('name', '')
        id_attr = element_info.get('id', '')
        text = element_info.get('text', '')

        xpaths = []

        # Basic element
        xpaths.append(f'//{element_type}')

        # With name attribute
        if name:
            xpaths.append(f'//{element_type}[contains(@name, "{name}")]')

        # With ID attribute
        if id_attr:
            xpaths.append(f'//{element_type}[contains(@id, "{id_attr}")]')

        # With text content
        if text:
            xpaths.append(f'//{element_type}[contains(text(), "{text}")]')

        # Convert XPath to CSS-equivalent for Playwright
        css_equivalents = []
        for xpath in xpaths:
            css = self._xpath_to_css(xpath)
            if css:
                css_equivalents.append(css)

        return ' >> '.join(css_equivalents) if css_equivalents else f'//{element_type}'

    def _xpath_to_css(self, xpath: str) -> Optional[str]:
        """Convert simple XPath to CSS selector"""
        # Simple XPath to CSS conversion
        xpath = xpath.strip()

        if xpath.startswith('//'):
            xpath = xpath[2:]

        # Handle basic element selectors
        if '/' not in xpath and '[' not in xpath:
            return xpath

        # Handle attribute selectors
        if '[' in xpath and ']' in xpath:
            element = xpath.split('[')[0]
            attr_content = xpath.split('[')[1].split(']')[0]

            if 'contains(@name,' in attr_content:
                name = attr_content.split('"')[1]
                return f'{element}[name*="{name}"]'
            elif 'contains(@id,' in attr_content:
                id_val = attr_content.split('"')[1]
                return f'{element}[id*="{id_val}"]'
            elif 'contains(text(),' in attr_content:
                text = attr_content.split('"')[1]
                return f'{element}:has-text("{text}")'

        return None

    def _is_dynamic_class(self, class_name: str) -> bool:
        """Check if class name appears to be dynamically generated"""
        # Common patterns for dynamic classes
        dynamic_patterns = [
            r'^[a-f0-9]{8,}$',  # Hash-like strings
            r'^\w{32,}$',       # Long random strings
            r'\d{4,}',          # Long numbers
            r'js-',             # JavaScript-generated classes
            r'react-',          # React-generated classes
        ]

        for pattern in dynamic_patterns:
            if re.search(pattern, class_name):
                return True

        return False

    def analyze_element_context(self, html_fragment: str, element_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze HTML context to generate better selectors

        Args:
            html_fragment: HTML snippet containing the element
            element_info: Basic element information

        Returns:
            Enhanced element information with context
        """
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_fragment, 'html.parser')

            # Find the target element
            element_type = element_info.get('type', '')
            target_element = None

            # Try different strategies to find the element
            if element_info.get('id'):
                target_element = soup.find(id=element_info['id'])
            elif element_info.get('name'):
                target_element = soup.find(attrs={'name': element_info['name']})
            elif element_info.get('class'):
                classes = element_info['class'].split()
                target_element = soup.find(class_=classes[0])

            if target_element:
                # Extract additional context
                context = {
                    'tag_name': target_element.name,
                    'parent_classes': [],
                    'sibling_count': len(list(target_element.parent.children)) if target_element.parent else 0,
                    'has_siblings': len(list(target_element.parent.children)) > 1 if target_element.parent else False,
                }

                # Get parent classes
                if target_element.parent:
                    parent_classes = target_element.parent.get('class', [])
                    context['parent_classes'] = parent_classes

                # Check for unique identifiers
                if target_element.get('data-testid'):
                    context['test_id'] = target_element.get('data-testid')
                if target_element.get('aria-label'):
                    context['aria_label'] = target_element.get('aria-label')

                element_info.update(context)

        except Exception as e:
            print(f"Error analyzing element context: {e}")

        return element_info
