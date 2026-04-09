files = [
    'lib/screens/onboarding/income_setup_screen.dart',
    'lib/screens/onboarding/goals_setup_screen.dart',
    'lib/screens/onboarding/budget_review_screen.dart',
]

for path in files:
    with open(path, encoding='utf-8') as f:
        content = f.read()
    # Replace bare $ string interpolation patterns used as currency
    # These appear as '${...}' in Dart strings (currency display)
    import re
    # Replace currency-style usages: '\$X' or '\${expr}' at start of string literals
    content = content.replace("'\\${monthlyAmount.toStringAsFixed(0)}/month'",
                               "'GHS \${monthlyAmount.toStringAsFixed(0)}/month'")
    content = content.replace("'\\${(monthlyAmount * 12).toStringAsFixed(0)}/year'",
                               "'GHS \${(monthlyAmount * 12).toStringAsFixed(0)}/year'")
    content = content.replace("'\\${monthlyRequired.toStringAsFixed(0)}/month for",
                               "'GHS \${monthlyRequired.toStringAsFixed(0)}/month for")
    content = content.replace("'Need \\${monthlyRequired.toStringAsFixed(0)}/month",
                               "'Need GHS \${monthlyRequired.toStringAsFixed(0)}/month")
    content = content.replace("'you have \\${monthlySavings.toStringAsFixed(0)})'",
                               "'you have GHS \${monthlySavings.toStringAsFixed(0)})'")
    content = content.replace("'\\${monthlySavings.toStringAsFixed(0)}/month'",
                               "'GHS \${monthlySavings.toStringAsFixed(0)}/month'")
    content = content.replace("'\\${amount.toStringAsFixed(0)}'",
                               "'GHS \${amount.toStringAsFixed(0)}'")
    content = content.replace("'\\${income.toStringAsFixed(0)}'",
                               "'GHS \${income.toStringAsFixed(0)}'")
    content = content.replace("'\\${expenses.toStringAsFixed(0)}'",
                               "'GHS \${expenses.toStringAsFixed(0)}'")
    content = content.replace("'\\${savings.toStringAsFixed(0)}'",
                               "'GHS \${savings.toStringAsFixed(0)}'")
    content = content.replace("'\\${expense.monthlyAmount.toStringAsFixed(0)}'",
                               "'GHS \${expense.monthlyAmount.toStringAsFixed(0)}'")
    content = content.replace("'\\${goal.targetAmount.toStringAsFixed(0)}'",
                               "'GHS \${goal.targetAmount.toStringAsFixed(0)}'")
    content = content.replace("'\\${monthlyPerGoal.toStringAsFixed(0)}/month'",
                               "'GHS \${monthlyPerGoal.toStringAsFixed(0)}/month'")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {path}')
